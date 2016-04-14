﻿using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Bloom.MiscUI;
using Bloom.Properties;
using Bloom.ToPalaso;
using Bloom.WebLibraryIntegration;
using Bloom.Workspace;
using DesktopAnalytics;
using L10NSharp;
using Microsoft.Win32;
using SIL.IO;
using SIL.PlatformUtilities;
using SIL.Reporting;
#if !__MonoCS__
using Squirrel;
#endif

namespace Bloom
{
	/// <summary>
	/// Code to work with the Squirrel installer package. This package basically just installs and manages updating
	/// the appropriate files; thus, tasks like updating the registry must be done in the application, which is
	/// invoked with certain command-line arguments to request this. (However, Bloom sets up all the registry
	/// entries every time it is run, to support multi-channel installation with the most recently run version
	/// taking responsibility for opening files and handling downloads.)
	/// </summary>
	static class InstallerSupport
	{
		internal static UpdateVersionTable.UpdateTableLookupResult _updateTableLookupResult;

		internal static void RemoveBloomRegistryEntries()
		{
			RemoveRegistryKey(null, ".BloomPack");
			RemoveRegistryKey(null, ".BloomPackFile");
			RemoveRegistryKey(null, ".BloomCollection");
			RemoveRegistryKey(null, ".BloomCollectionFile");
			RemoveRegistryKey(null, "Bloom.BloomPack");
			RemoveRegistryKey(null, "Bloom.BloomPackFile");
			RemoveRegistryKey(null, "Bloom.BloomCollection");
			RemoveRegistryKey(null, "Bloom.BloomCollectionFile");
			RemoveRegistryKey(null, "bloom");
		}

		internal static void RemoveRegistryKey(string parentName, string keyName)
		{
			var root = HiveToMakeRegistryKeysIn;
			var key = String.IsNullOrEmpty(parentName) ? root : root.OpenSubKey(parentName);
			if (key != null)
			{
				key.DeleteSubKeyTree(keyName, false);
			}
		}


		/// <summary>
		/// Note: this actually has to go out over the web to get the answer, and so it may fail
		/// </summary>
		internal static UpdateVersionTable.UpdateTableLookupResult LookupUrlOfSquirrelUpdate()
		{
			if (_updateTableLookupResult == null)
			{
				_updateTableLookupResult = new UpdateVersionTable().LookupURLOfUpdate();
			}
			return _updateTableLookupResult;
		}

		internal static void HandleSquirrelInstallEvent(string[] args)
		{
#if __MonoCS__
			Debug.Fail("HandleSquirrelInstallEvent should not run on Linux!");	// and the code below doesn't compile on Linux
			return;
#else
			bool firstTime = false;
			var updateUrlResult = LookupUrlOfSquirrelUpdate();
			// Should only be null if we're not online. Not sure how squirrel will handle that,
			// but at least one of these operations is responsible for setting up shortcuts to the program,
			// which we'd LIKE to work offline. Passing it a plausible url, even though it will presumably fail,
			// seems less likely to cause problems than passing null.
			if(string.IsNullOrEmpty(updateUrlResult.URL))
				updateUrlResult.URL = @"https://s3.amazonaws.com/bloomlibrary.org/squirrel";
			if (args[0] == "--squirrel-uninstall")
			{
				RemoveBloomRegistryEntries();
			}
			if (args[0] == "--squirrel-updated")
			{
				var props = new Dictionary<string, string>();
				if (args.Length > 1)
					props["newVersion"] = args[1];
				props["channel"] = ApplicationUpdateSupport.ChannelName;
				Analytics.Track("Update Version", props);
			}
			string iconPath = null;
			if (args[0] == "--squirrel-install")
			{
				// Normally this is done on every run of the program, but if we're doing a silent allUsers install,
				// this is our only time running with admin privileges so we can actually make the entries for all users.
				MakeBloomRegistryEntries(args);
				// Normally we can't do this in our quick silent run as part of install, because of the need to escalate
				// privilege. But if we're being installed for all users we must already be running as admin.
				// We don't need to do an extra restart of Bloom because this install-setup run of Bloom will finish
				// right away anyway.
				if (SharedByAllUsers())
					FontInstaller.InstallFont("AndikaNewBasic", needsRestart:false);
			}
			switch (args[0])
			{
				// args[1] is version number
				case "--squirrel-install": // (first?) installed
				case "--squirrel-updated": // updated to specified version
				case "--squirrel-obsolete": // this version is no longer newest
				case "--squirrel-uninstall": // being uninstalled
					using (var mgr = new UpdateManager(updateUrlResult.URL, Application.ProductName))
					{
						// Note, in most of these scenarios, the app exits after this method
						// completes!
						// We replace two of the usual calls in order to take control of where shortcuts are installed.
						SquirrelAwareApp.HandleEvents(
							onInitialInstall: v => mgr.CreateShortcutsForExecutable(Path.GetFileName(Assembly.GetEntryAssembly().Location),
								StartMenuLocations,
								false, // not just an update, since this is case initial install
								SharedByAllUsers()),
							onAppUpdate: v => mgr.CreateShortcutForThisExe(),
							onAppUninstall: v => mgr.RemoveShortcutsForExecutable(Path.GetFileName(Assembly.GetEntryAssembly().Location), StartMenuLocations, SharedByAllUsers()),
							onFirstRun: () => firstTime = true,
							arguments: args);
					}
					break;
			}
#endif
		}

		/// <summary>
		/// True if we consider our install to be shared by all users of the computer.
		/// We currently detect this based on being in the Program Files folder.
		/// </summary>
		/// <returns></returns>
		public static bool SharedByAllUsers()
		{
			// Being a 32-bit app, we expect to get installed in Program Files (x86) on a 64-bit system.
			// If we are in fact on a 32-bit system, we will be in plain Program Files...but on such a system that's what this code gets.
			return Application.ExecutablePath.StartsWith(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86));
		}

#if !__MonoCS__
		private static ShortcutLocation StartMenuLocations
		{
			get { return ShortcutLocation.Desktop | ShortcutLocation.StartMenuPrograms; }
		}
#endif

		static bool IsFirstTimeInstall(string[] programArgs)
		{
			if (programArgs.Length < 1)
				return false;
			return programArgs[0] == "--squirrel-install";
		}

		private static bool _installInLocalMachine;

		/// <summary>
		/// Make the registry entries Bloom requires.
		/// We do this every time a version of Bloom runs, so that if more than one is installed the latest wins.
		/// </summary>
		internal static void MakeBloomRegistryEntries(string[] programArgs)
		{
			if (Assembly.GetEntryAssembly() == null)
				return; // unit testing.
			// When installed in program files we only do registry entries when we are first installed,
			// thus keeping them consistent for all users, stored in HKLM.
			if (SharedByAllUsers() && !IsFirstTimeInstall(programArgs))
				return;
			_installInLocalMachine = SharedByAllUsers();
			if (Platform.IsLinux)
			{
				// This will be done by the package installer.
				return;
			}

			var iconDir = FileLocator.GetDirectoryDistributedWithApplication("icons");

			// This is what I (JohnT) think should make Bloom display the right icon for .BloomCollection files.
			EnsureRegistryValue(@".BloomCollection\DefaultIcon", Path.Combine(iconDir, "BloomCollectionIcon.ico"));
			EnsureRegistryValue(@".BloomPack\DefaultIcon", Path.Combine(iconDir, "BloomPack.ico"));

			// These may also be connected with making BloomCollection files display the correct icon.
			// Based on things found in (or done by) the old wix installer.
			EnsureRegistryValue(".BloomCollection", "Bloom.BloomCollectionFile");
			EnsureRegistryValue(".BloomCollectionFile", "Bloom.BloomCollectionFile");
			EnsureRegistryValue("Bloom.BloomCollectionFile", "Bloom Book Collection");
			EnsureRegistryValue(@"Bloom.BloomCollectionFile\DefaultIcon", Path.Combine(iconDir, "BloomCollectionIcon.ico, 0"));

			// I think these help BloomPack files display the correct icon.
			EnsureRegistryValue(".BloomPack", "Bloom.BloomPackFile");
			EnsureRegistryValue("Bloom.BloomPackFile", "Bloom Book Collection");
			EnsureRegistryValue(".BloomPackFile", "Bloom Book Collection");
			EnsureRegistryValue(@"Bloom.BloomPackFile\DefaultIcon", Path.Combine(iconDir, "BloomPack.ico, 0"));
			EnsureRegistryValue(@".BloomPackFile\DefaultIcon", Path.Combine(iconDir, "BloomPack.ico, 0"));
			EnsureRegistryValue(@"SOFTWARE\Classes\Bloom.BloomPack", "Bloom Book Pack", "FriendlyTypeName");

			// This might be part of registering as the executable for various file types?
			// I don't know what does it in wix but it's one of the things the old wix installer created.
			var exe = Assembly.GetExecutingAssembly().Location;
			EnsureRegistryValue(@"bloom\shell\open\command", "\"" + exe + "\" \"%1\"");

			BeTheExecutableFor(".BloomCollection", "BloomCollection file");
			BeTheExecutableFor(".BloomPack", "BloomPack file");
			// Make the OS run Bloom when it sees bloom://somebooktodownload
			BookDownloadSupport.RegisterForBloomUrlProtocol(_installInLocalMachine);

		}

		internal static void BeTheExecutableFor(string extension, string description)
		{
			// e.g.: HKLM\SOFTWARE\Classes\.BloomCollectionFile\Content Type: "application/bloom"
			var fileKey = extension + "File";
			EnsureRegistryValue(fileKey, "application/bloom", "Content Type");
			// e.g.: HKLM\SOFTWARE\Classes\Bloom.BloomCollectionFile\shell\open\: "Open"
			var bloomFileKey = "Bloom" + fileKey;
			EnsureRegistryValue(bloomFileKey + @"\shell\open", "Open");
			// e.g.: HKLM\SOFTWARE\Classes\Bloom.BloomCollectionFile\shell\open\command\: ""C:\Program Files (x86)\Bloom\Bloom.exe" "%1""
			var exe = Assembly.GetExecutingAssembly().Location;
			EnsureRegistryValue(bloomFileKey + @"\shell\open\command", "\"" + exe + "\" \"%1\"");

		}

		internal static void EnsureRegistryValue(string keyName, string value, string name="")
		{
			RegistryKey root = HiveToMakeRegistryKeysIn;

			var key = root.CreateSubKey(keyName); // may also open an existing key with write permission
			try
			{
				if (key != null)
				{
					var current = (key.GetValue(name) as string);
					if (current != null && current.ToLowerInvariant() == value)
						return; // already set as wanted
				}
				key.SetValue(name, value);

			}
			catch (UnauthorizedAccessException ex)
			{
				// If for some reason we aren't allowed to do it, just don't.
				Logger.WriteEvent("Unable to set registry entry {0}:{1} to {2}: {3}", keyName, name, value, ex.Message);
			}
		}

		private static RegistryKey HiveToMakeRegistryKeysIn
		{
			get
			{
				if (SharedByAllUsers())
					return Registry.LocalMachine.CreateSubKey(@"Software\Classes");
				else
					return Registry.CurrentUser.CreateSubKey(@"Software\Classes");
			}
		}
	}
}
