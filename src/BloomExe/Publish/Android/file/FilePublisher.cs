// // Copyright (c) 2017 SIL International
// // This software is licensed under the MIT License (http://opensource.org/licenses/MIT)

using System.Collections.Generic;
using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Bloom.Book;
using Bloom.Properties;
using Bloom.web;
using L10NSharp;
using Bloom.Utils;

namespace Bloom.Publish.Android.file
{
	/// <summary>
	/// Saves a .bloompub as a local file which the user can somehow get onto devices using some other tools.
	/// </summary>
	public class FilePublisher
	{
		public static void Save(Book.Book book, BookServer bookServer, Color backColor, WebSocketProgress progress, AndroidPublishSettings settings = null)
		{
			var progressWithL10N = progress.WithL10NPrefix("PublishTab.Android.File.Progress.");

			var initialPath = OutputFilenames.GetOutputFilePath(book, BloomPubMaker.BloomPubExtensionWithDot, Settings.Default.BloomDeviceFileExportFolder);

			var bloomdFileDescription = LocalizationManager.GetString("PublishTab.Android.bloomdFileFormatLabel", "Bloom Book for Devices",
				"This is shown in the 'Save' dialog when you save a bloom book in the format that works with the Bloom Reader Android App");
			var filter = $"{bloomdFileDescription}|*{BloomPubMaker.BloomPubExtensionWithDot}";

			var destFileName = Utils.MiscUtils.GetOutputFilePathOutsideCollectionFolder(initialPath, filter);
			if (String.IsNullOrEmpty(destFileName))
				return;

			OutputFilenames.RememberOutputFilePath(book, BloomPubMaker.BloomPubExtensionWithDot, destFileName);
			Settings.Default.BloomDeviceFileExportFolder = Path.GetDirectoryName(destFileName);
			PublishToAndroidApi.CheckBookLayout(book, progress);
			PublishToAndroidApi.SendBook(book, bookServer, destFileName, null,
				progressWithL10N,
				(publishedFileName, bookTitle) => progressWithL10N.GetMessageWithParams("Saving", "{0} is a file path", "Saving as {0}", destFileName),
				null,
				backColor,
				settings: settings);
			PublishToAndroidApi.ReportAnalytics("file", book);
		}
	}
}
