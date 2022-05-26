using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Bloom.Api;
using Bloom.Book;
using Bloom.Collection;
using Bloom.CollectionTab;
using Bloom.MiscUI;
using Bloom.Properties;
using Bloom.Spreadsheet;
using Bloom.TeamCollection;
using DesktopAnalytics;
using L10NSharp;
using SIL.IO;
using SIL.Reporting;

namespace Bloom.web.controllers
{
	/// <summary>
	/// Commands that affect entire books, typically menu commands in the Collection tab right-click menu
	/// </summary>
	public class BookCommandsApi
	{
		private readonly CollectionModel _collectionModel;
		private BookSelection _bookSelection;
		private readonly SpreadsheetApi _spreadsheetApi;
		private readonly BloomWebSocketServer _webSocketServer;
		private string _previousTargetSaveAs; // enhance: should this be shared with CollectionApi or other save as locations?

		public BookCommandsApi(CollectionModel collectionModel, BloomWebSocketServer webSocketServer, BookSelection bookSelection, SpreadsheetApi spreadsheetApi)
		{
			_collectionModel = collectionModel;
			_webSocketServer = webSocketServer;
			_bookSelection = bookSelection;
			this._spreadsheetApi = spreadsheetApi;
			_collectionModel.BookCommands = this;
		}

		public void RegisterWithApiHandler(BloomApiHandler apiHandler)
		{
			// Must not require sync, because it launches a Bloom dialog, which will make other api requests
			// that will be blocked if this is locked.
			apiHandler.RegisterEndpointHandler("bookCommand/exportToSpreadsheet",
				(request) =>
				{
					_spreadsheetApi.ShowExportToSpreadsheetUI(GetBookObjectFromPost(request));
					request.PostSucceeded();
				}, true, false);
			apiHandler.RegisterEndpointHandler("bookCommand/enhanceLabel", (request) =>
			{
				// We want this to be fast...many things are competing for api handling threads while
				// Bloom is starting up, including many buttons sending this request...
				// so we'll postpone until idle even searching for the right BookInfo.
				var collection = request.RequiredParam("collection-id").Trim();
				var id = request.RequiredParam("id");
				RequestButtonLabelUpdate(collection, id);
				request.PostSucceeded();
			}, false, false);
			apiHandler.RegisterBooleanEndpointHandler("bookCommand/decodable",
				request => { return _collectionModel.IsBookDecodable;},
				(request, b) => { _collectionModel.SetIsBookDecodable(b);},
				true);
			apiHandler.RegisterBooleanEndpointHandler("bookCommand/leveled",
				request => { return _collectionModel.IsBookLeveled; },
				(request, b) => { _collectionModel.SetIsBookLeveled(b); },
				true);
			apiHandler.RegisterEndpointLegacy("bookCommand/", HandleBookCommand, true);
		}

		public void RequestButtonLabelUpdate(string collectionPath, string id)
		{
			var oldCount = _buttonsNeedingSlowUpdate.Count;
			_buttonsNeedingSlowUpdate.Enqueue(Tuple.Create(collectionPath, id));
			// I'm nervous about messing with event subscriptions and unsubscriptions on multiple threads,
			// but it is undesirable to leave the idle event running forever once there is nothing to enhance.
			// Therefore, the event handler removes itself when it finds nothing in the queue, and so
			// we need to make sure we have one when we put something into the queue. That could easily result in the event
			// handler being present many times, leading to longer delays when the event is raised, so we
			// remove it before adding it.
			// So far so good, but we need to consider race conditions. I very much don't want to use Invoke
			// here, and would prefer to avoid even a lock, so as to minimize the time that handling this
			// event keeps a server thread busy during application startup.
			// So, what can go wrong? The last thing we do in relation to the event is to add the handler.
			// At that point, there is a handler, so the button will eventually get processed.
			// It turns out we have to add the event handler on the UI thread. If that were not the case,
			// we could get more than one handler added: context switches could cause unsubscribe
			// to happen on multiple threads, followed by two or more threads subscribing. This would be fairly
			// harmless: at worst, each subscription results in one button being enhanced, and once the queue
			// is empty, successive calls to the handler will eventually remove all of them.
			// More worrying is this possibility:
			// - event handler looks at queue and finds nothing. Before the code in that method for removing the handler executes,
			// - context switch to server thread which adds event, removes and adds handler, we have 1 handler
			// - context switch back to event handler, which proceeds to remove the handler. We have 0 handlers,
			// but a button queued. I don't think this could happen given that we have to Invoke to subscribe,
			// but just in case, the handler is careful about how it removes itself to prevent this.
			if (oldCount == 0) // otherwise, we must already have a subscription
			{
				// I can't find any documentation indicating that we must use Invoke here, but if we don't,
				// it doesn't work: the event handler is never called. So I'm going to compromise and let
				// the first call to this (and the first after we empty the queue) do so. (There may be a race
				// condition in which more than one thread does it, but that's OK because we remove before adding.)
				var formToInvokeOn = Application.OpenForms.Cast<Form>().FirstOrDefault(f => f is Shell);
				if (formToInvokeOn != null)
				{
					formToInvokeOn.Invoke((Action)(() =>
					{
						Application.Idle -= EnhanceButtonNeedingSlowUpdate;
						Application.Idle += EnhanceButtonNeedingSlowUpdate;
					}));
				}
			}
		}

		private ConcurrentQueue<Tuple<string,string>> _buttonsNeedingSlowUpdate = new ConcurrentQueue<Tuple<string, string>>();

		private void EnhanceButtonNeedingSlowUpdate(object sender, EventArgs e)
		{
			Tuple<string, string> item;
			
			if (!_buttonsNeedingSlowUpdate.TryDequeue(out item))
			{
				Application.Idle -= EnhanceButtonNeedingSlowUpdate;
				// If you ignore threading, it would seem we could just return here.
				// And given that we're invoking for subscriptions, I think it would be OK.
				// But if we were ever able to subscribe on a different thread,
				// then between the TryDeque and removing the event handler,
				// another thread might add an item, or even more than one! Then we'd have
				// queued items and no event handler looking for them!
				// So, after removing the event handler, we try AGAIN to Deque an item.
				if (_buttonsNeedingSlowUpdate.TryDequeue(out item))
				{
					// And if we succeed, we put the event handler back. This might be
					// redundant, but I don't think it always is (multiple items might have been
					// added between the TryDeque and removing the handler above), and it is
					// harmless...if we don't need it, we'll just do one more cycle of
					// running this handler, finding no items, and removing the handler.
					Application.Idle += EnhanceButtonNeedingSlowUpdate;
				}
				else
				{
					// Now we can safely return. Another thread might have added an item
					// between the TryDeque and this return, but it will also have restored
					// the event handler, so we'll handle the new item on the next invocation.
					return;
				}
			}

			var bookInfo = _collectionModel.BookInfoFromCollectionAndId(item.Item1, item.Item2);
			if (bookInfo == null || bookInfo.FileNameLocked)
				return; // the title it already has is the folder name which is the right locked name.
			var langCodes = _collectionModel.CollectionSettings.GetAllLanguageCodes().ToList();
			var bestTitle = bookInfo.GetBestTitleForUserDisplay(langCodes);
			if (String.IsNullOrEmpty(bestTitle))
			{
				// Getting the book can be very slow for large books: do we really want to update the title enough to make the user wait?
				// (Yes, we're doing this lazily, one book at a time, while the system is idle. But we're tying up the UI thread
				// for as long as it takes to load any one book. That might be a noticeable unresponsiveness. OTOH, it's only happening
				// once per book, after which, the titles should be in meta.json and can be loaded fairly quickly. This will be less and less
				// of an issue as books that don't have the titles in meta.json become fewer and fewer.)
				var book = LoadBookAndBringItUpToDate(bookInfo, out bool badBook);
				if (book == null)
					return; // can't get the book, can't improve title
				bestTitle = book.NameBestForUserDisplay;
			}

			if (bestTitle != bookInfo.QuickTitleUserDisplay)
			{
				UpdateButtonTitle(_webSocketServer, bookInfo, bestTitle);
			}
		}

		public static void UpdateButtonTitle(BloomWebSocketServer server, BookInfo bookInfo, string bestTitle)
		{

			server.SendString("book", IdForBookButton(bookInfo), bestTitle);
		}

		/// <summary>
		/// We identify a book, for purposes of updating the title of the right button,
		/// by a combination of the collection path and the book ID.
		/// We can't use the full path to the book, because we need to be able to update the
		/// button when its folder changes.
		/// We need the collection path because we're not entirely confident that there can't
		/// be duplicate book IDs across collections.
		/// </summary>
		/// <param name="info"></param>
		/// <returns></returns>
		public static string IdForBookButton(BookInfo info)
		{
			return "label-" + Path.GetDirectoryName(info.FolderPath) + "-" + info.Id;
		}

		private bool _alreadyReportedErrorDuringImproveAndRefreshBookButtons;
		private Book.Book LoadBookAndBringItUpToDate(BookInfo bookInfo, out bool badBook)
		{
			try
			{
				badBook = false;
				return _collectionModel.GetBookFromBookInfo(bookInfo);
			}
			catch (Exception error)
			{
				//skip over the dependency injection layer
				if (error.Source == "Autofac" && error.InnerException != null)
					error = error.InnerException;
				Logger.WriteEvent("There was a problem with the book at " + bookInfo.FolderPath + ". " + error.Message);
				if (!_alreadyReportedErrorDuringImproveAndRefreshBookButtons)
				{
					_alreadyReportedErrorDuringImproveAndRefreshBookButtons = true;
					SIL.Reporting.ErrorReport.NotifyUserOfProblem(error,
						"There was a problem with the book at {0}. \r\n\r\nClick the 'Details' button for more information.\r\n\r\nOther books may have this problem, but this is the only notice you will receive.\r\n\r\nSee 'Help:Show Event Log' for any further errors.",
						bookInfo.FolderPath);
				}
				badBook = true;
				return null;
			}
		}

		private void HandleBookCommand(ApiRequest request)
		{
			var book = GetBookObjectFromPost(request);
			var command = request.LocalPath().Substring((BloomApiHandler.ApiPrefix + "bookCommand/").Length);
			switch (command)
			{
				case "makeBloompack":
					HandleMakeBloompack(book);
					break;
				case "openFolderOnDisk":
					// Currently, the request comes with data to let us identify which book,
					// but it will always be the current book, which is all the model api lets us open anyway.
					//var book = GetBookObjectFromPost(request);
					_collectionModel.OpenFolderOnDisk();
					break;
				case "exportToWord":
					HandleExportToWord(book);
					break;
				// As currently implemented this would more naturally go in CollectionApi, since it adds a book
				// to the collection (a backup). However, we are probably going to change how backups are handled
				// so this is no longer true.
				case "importSpreadsheetContent":
					_spreadsheetApi.HandleImportContentFromSpreadsheet(book);
					break;
				case "saveAsDotBloomSource":
					HandleSaveAsDotBloomSource(book);
					break;
				case "updateThumbnail":
					ScheduleRefreshOfOneThumbnail(book);
					break;
				case "updateBook":
					HandleBringBookUpToDate(book);
					break;
				case "rename":
					HandleRename(book, request);
					break;
			}
			request.PostSucceeded();
		}

		private void HandleRename(Book.Book book, ApiRequest request)
		{
			var newName = request.RequiredParam("name");
			book.SetAndLockBookName(newName);

			_collectionModel.UpdateLabelOfBookInEditableCollection(book);
		}


		private void HandleMakeBloompack(Book.Book book)
		{
			string chosenFilename = GetOutputFileOutsideBookFolder(".BloomPack", "BloomPack files|*.BloomPack|All files (*.*)|*.*", book.Storage);
			if (String.IsNullOrEmpty(chosenFilename))
				return;
			_collectionModel.MakeSingleBookBloomPack(chosenFilename, book.Storage.FolderPath);
		}

		public string GetOutputFileOutsideBookFolder(string defaultExtension, string filter, IBookStorage bookStorage)
		{
			var folder = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
			if (!string.IsNullOrEmpty(_previousTargetSaveAs) && Directory.Exists(_previousTargetSaveAs))
				folder = _previousTargetSaveAs;
			var initialPath = Path.Combine(folder, bookStorage.FolderName + defaultExtension);
			var collectionFolder = Path.GetDirectoryName(bookStorage.FolderPath);

			var destFileName = Utils.MiscUtils.GetOutputFilePathOutsideCollectionFolder(initialPath, filter, collectionFolder);

			if (!String.IsNullOrEmpty(destFileName))
				_previousTargetSaveAs = Path.GetDirectoryName(destFileName);
			return destFileName;
		}

		private void HandleExportToWord(Book.Book book)
		{
			try
			{
				var destPath = GetOutputFileOutsideBookFolder(".doc", "Document files|*.doc|All files (*.*)|*.*", book.Storage);
				if (String.IsNullOrEmpty(destPath))
					return;
				MessageBox.Show(LocalizationManager.GetString("CollectionTab.BookMenu.ExportDocMessage",
					"Bloom will now open this HTML document in your word processing program (normally Word or LibreOffice). You will be able to work with the text and images of this book. These programs normally don't do well with preserving the layout, so don't expect much."));
				_collectionModel.ExportDocFormat(destPath);
				PathUtilities.OpenFileInApplication(destPath);
				Analytics.Track("Exported To Doc format");
			}
			catch (IOException error)
			{
				SIL.Reporting.ErrorReport.NotifyUserOfProblem(error.Message, "Could not export the book");
				Analytics.ReportException(error);
			}
			catch (Exception error)
			{
				SIL.Reporting.ErrorReport.NotifyUserOfProblem(error, "Could not export the book");
				Analytics.ReportException(error);
			}
		}


		private void ScheduleRefreshOfOneThumbnail(Book.Book book)
		{
			_collectionModel.UpdateThumbnailAsync(book);
		}

		internal void HandleSaveAsDotBloomSource(Book.Book book)
		{
			HandleBringBookUpToDate(book);

			const string bloomFilter = "Bloom Source files (*.bloomSource)|*.bloomSource|All files (*.*)|*.*";
			var destFileName = GetOutputFileOutsideBookFolder(".bloomSource", bloomFilter, book.Storage);
			if (String.IsNullOrEmpty(destFileName))
				return;

			if (!CollectionModel.SaveAsBloomSourceFile(book.StoragePageFolder, destFileName, out var exception))
			{
				// Purposefully not adding to the L10N burden...
				NonFatalProblem.Report(ModalIf.All, PassiveIf.None,
					shortUserLevelMessage: "The file could not be saved. Make sure it is not open and try again.",
					moreDetails: null,
					exception: exception, showSendReport: false);
			}
		}

		private void HandleBringBookUpToDate(Book.Book book)
		{
			try
			{
				// Currently this works on the current book, so the argument is ignored.
				// That's OK for now as currently the book passed will always be the current one.
				_collectionModel.BringBookUpToDate();
			}
			catch (Exception error)
			{
				var msg = LocalizationManager.GetString("Errors.ErrorUpdating",
					"There was a problem updating the book.  Restarting Bloom may fix the problem.  If not, please report the problem to us.");
				ErrorReport.NotifyUserOfProblem(error, msg);
			}
		}
		private BookInfo GetBookInfoFromPost(ApiRequest request)
		{
			var bookId = request.RequiredPostString();
			return GetCollectionOfRequest(request).GetBookInfos().FirstOrDefault(info => info.Id == bookId);
		}

		private Book.Book GetBookObjectFromPost(ApiRequest request)
		{
			var info = GetBookInfoFromPost(request);
			return _collectionModel.GetBookFromBookInfo(info);

		}
		private BookCollection GetCollectionOfRequest(ApiRequest request)
		{
			var id = request.RequiredParam("collection-id").Trim();
			var collection = _collectionModel.GetBookCollections().FirstOrDefault(c => c.PathToDirectory == id);
			if (collection == null)
			{
				request.Failed($"Collection named '{id}' was not found.");
			}

			return collection;
		}
	}
}
