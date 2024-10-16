﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml;
using Bloom.Book;

namespace Bloom
{
	/// <summary>
	/// Everything which implements this will be found by the IOC assembly scanner
	/// and made available to any constructors which call for an IEnumerable<ICommand/>
	/// </summary>
	public interface ICommand
	{
		void Execute();
		bool Enabled { get; set; }
		event EventHandler EnabledChanged;
	}

	public abstract class Command : ICommand
	{
		public event EventHandler EnabledChanged;
		private bool _enabled;

		public Command(string name)
		{
			Name = name;
			_enabled = true;
		}

		public bool Enabled
		{
			get { return Implementer != null && _enabled; }
			set
			{
				_enabled = value;
				RaiseEnabledChanged();
			}
		}
		public Action Implementer { get; set; }
		public string Name { get; set; }

		// These Command objects are often executed in response to mouse button clicks on controls.
		// At least for the Mono runtime (and maybe for .Net as well), a user double clicking a button
		// control generates two separate click events (and never generates a double-click event), the
		// second of which is processed after the first one finishes being processed.  At least one
		// Command implementation function ("Duplicate Page") changes the state of the system (current
		// page) while also verifying that the state is the same as when the user clicked.  To avoid
		// undesired multiple execution of the command, and to avoid possible error messages, we need
		// to "debounce" the mouse clicks by waiting a minimum amount of time between allowing command
		// executions.  See https://silbloom.myjetbrains.com/youtrack/issue/BL-3426 for the need for
		// this fix.

		public void Execute()
		{
			if (Bouncing())
				return;			// Ignore a second click event generated by the user double clicking.
			Implementer();
			SetBounceTime();	// Start bounce timing here in case implementer is slow.
		}

		/// <summary>
		/// The standard bounce interval is set to the default double-click timing for Windows.  This
		/// seems to be as good a waiting period as any -- long enough to handle double-clicking as
		/// desired (ignore the second click), but short enough not to slow down the user too much if
		/// muliple operations are really desired.
		/// </summary>
		private readonly static TimeSpan _bounceWait = TimeSpan.FromMilliseconds(500);
		private static DateTime _previousClickTime = DateTime.MinValue;
		/// <summary>
		/// Check whether the click activating this command came too quickly to be a separate command.
		/// This handles people double-clicking when they should single click (or clicking again while
		/// a command is executing that takes longer than they think it should).
		/// </summary>
		private static bool Bouncing()
		{
			var now = DateTime.Now;
			var bouncing = now - _previousClickTime < _bounceWait;
			_previousClickTime = now;
			return bouncing;
		}

		private static void SetBounceTime()
		{
			// We could check whether a reset is really needed, or maybe even reset it a bit earlier
			// than "now" to reduce the effect of the fixed _bounceWait interval, but that seems like
			// it's getting too fancy to be worthwhile.
			_previousClickTime = DateTime.Now;
		}

		protected virtual void RaiseEnabledChanged()
		{
			var handler = EnabledChanged;
			if(handler != null)
				handler(this, EventArgs.Empty);
		}
	}

	public class CutCommand : Command
	{
		public CutCommand()
			: base("cut")
		{

		}
	}

	public class CopyCommand : Command
	{
		public CopyCommand()
			: base("copy")
		{

		}
	}

	public class PasteCommand : Command
	{
		public PasteCommand()
			: base("paste")
		{

		}
	}
	public class UndoCommand : Command
	{
		public UndoCommand()
			: base("undo")
		{

		}
	}

	public class DuplicatePageCommand : Command
	{
		public DuplicatePageCommand()
			: base("duplicateCurrentPage")
		{

		}
	}

	public class DeletePageCommand : Command
	{
		public DeletePageCommand()
			: base("deleteCurrentPage")
		{

		}
	}


	public class TemplateInsertionCommand
	{
		public event EventHandler<PageInsertEventArgs> InsertPage;
		public Page MostRecentInsertedTemplatePage;

		public void Insert(Page page)
		{
			if (InsertPage != null)
			{
				MostRecentInsertedTemplatePage = page;
				InsertPage.Invoke(page, new PageInsertEventArgs(true));
			}
		}
	}

	public class PageInsertEventArgs : EventArgs
	{
		public bool FromTemplate;

		public PageInsertEventArgs(bool fromTemplate)
		{
			FromTemplate = fromTemplate;
		}
	}
}
