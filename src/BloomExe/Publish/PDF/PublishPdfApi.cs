using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Xml;
using Bloom.Api;
using Bloom.Book;
using GLib;
using SIL.IO;
using Application = System.Windows.Forms.Application;

namespace Bloom.Publish.PDF
{
	public class PublishPdfApi
	{
		private BookSelection _bookSelection;
		private readonly CurrentEditableCollectionSelection _currentBookCollectionSelection;
		private readonly BookServer _bookServer;
		private PdfMaker _pdfMaker;
		private readonly BloomWebSocketServer _webSocketServer;

		private string PdfFilePath;

		// This is to support orientation/page size changing during publishing, but I don't know whether we want to do that.
		public Layout PageLayout { get; set; }

		public PublishModel.BookletPortions BookletPortion { get; set; }

		public PublishPdfApi(BookSelection selection, CurrentEditableCollectionSelection currentBookCollectionSelection,
			BookServer bookServer, PdfMaker pdfMaker, BloomWebSocketServer webSocketServer)
		{
			_bookSelection = selection;
			_currentBookCollectionSelection = currentBookCollectionSelection;
			_bookServer = bookServer;
			_pdfMaker = pdfMaker;
			_webSocketServer = webSocketServer;
		}


		private const string kApiUrlPart = "publish/pdf/";

		public void RegisterWithApiHandler(BloomApiHandler apiHandler)
		{
			apiHandler.RegisterEndpointHandler(kApiUrlPart + "simple", HandleCreateSimplePdf, true);
		}

		private void HandleCreateSimplePdf(ApiRequest request)
		{
			BookletPortion = PublishModel.BookletPortions.AllPagesNoBooklet;
			MakePdf();
			request.PostSucceeded();
		}

		private Book.Book CurrentBook => _bookSelection.CurrentSelection;

		public void MakePdf()
		{
			var shell = Application.OpenForms.Cast<Form>().FirstOrDefault(f => f is Shell);
			var worker = new BackgroundWorker();
			worker.WorkerReportsProgress = true;
			worker.WorkerSupportsCancellation = true;
			worker.DoWork += new System.ComponentModel.DoWorkEventHandler((sender, doWorkEventArgs) =>
			{
				doWorkEventArgs.Result = BookletPortion; // cf PublishView._makePdfBackgroundWorker_DoWork
				try
				{
					using (var tempHtml = MakeFinalHtmlForPdfMaker())
					{
						//if (doWorkEventArgs.Cancel)
						//	return;
						PublishModel.BookletLayoutMethod layoutMethod = GetBookletLayoutMethod();

						// Check memory for the benefit of developers.  The user won't see anything.
						Bloom.Utils.MemoryManagement.CheckMemory(true, "about to create PDF file", false);
						_pdfMaker.MakePdf(new PdfMakingSpecs()
							{
								InputHtmlPath = tempHtml.Key,
								OutputPdfPath = PdfFilePath,
								PaperSizeName = PageLayout.SizeAndOrientation.PageSizeName,
								Landscape = PageLayout.SizeAndOrientation.IsLandScape,
								SaveMemoryMode = CurrentBook.UserPrefs.ReducePdfMemoryUse,
								LayoutPagesForRightToLeft = LayoutPagesForRightToLeft,
								BooketLayoutMethod = layoutMethod,
								BookletPortion = BookletPortion,
								BookIsFullBleed = CurrentBook.FullBleed,
								PrintWithFullBleed = GetPrintingWithFullBleed(),
								Cmyk = CurrentBook.UserPrefs.CmykPdf
							},
							worker, doWorkEventArgs, shell);
						dynamic messageBundle = new DynamicJson();
						messageBundle.path = PdfFilePath.ToLocalhost();
						// Todo: what should clean up this file when??
						_webSocketServer.SendBundle("publish", "pdfReady", messageBundle);
						// Warn the user if we're starting to use too much memory.
						Bloom.Utils.MemoryManagement.CheckMemory(false, "finished creating PDF file", true);
					}
				}
				catch (Exception e)
				{
					//we can't safely do any ui-related work from this thread, like putting up a dialog
					doWorkEventArgs.Result = e;
					//                SIL.Reporting.ErrorReport.NotifyUserOfProblem(e, "There was a problem creating a PDF from this book.");
					//                SetDisplayMode(DisplayModes.WaitForUserToChooseSomething);
					//                return;
				}
			});
			worker.RunWorkerAsync();
		}

		private SimulatedPageFile MakeFinalHtmlForPdfMaker()
		{
			PdfFilePath = GetPdfPath(Path.GetFileName(CurrentBook.FolderPath));

			//var orientationChanging = CurrentBook.GetLayout().SizeAndOrientation.IsLandScape !=
			//                          PageLayout.SizeAndOrientation.IsLandScape;
			var orientationChanging = true;
			PageLayout = CurrentBook.GetLayout();
			var dom = CurrentBook.GetDomForPrinting(BookletPortion, _currentBookCollectionSelection.CurrentSelection,
				_bookServer, orientationChanging, PageLayout);

			AddStylesheetClasses(dom.RawDom);

			PageLayout.UpdatePageSplitMode(dom.RawDom);
			if (CurrentBook.FullBleed && !GetPrintingWithFullBleed())
			{
				ClipBookToRemoveFullBleed(dom);
			}

			XmlHtmlConverter.MakeXmlishTagsSafeForInterpretationAsHtml(dom.RawDom);
			dom.UseOriginalImages = true; // don't want low-res images or transparency in PDF.
			return BloomServer.MakeSimulatedPageFileInBookFolder(dom, source: BloomServer.SimulatedPageFileSource.Pub);
		}

		private string GetPdfPath(string fname)
		{
			string path = null;

			// Sanitize fileName first
			string fileName = BookStorage.SanitizeNameForFileSystem(fname);

			for (int i = 0; i < 100; i++)
			{
				path = Path.Combine(Path.GetTempPath(), string.Format("{0}-{1}.pdf", fileName, i));
				if (!RobustFile.Exists(path))
					break;

				try
				{
					RobustFile.Delete(path);
					break;
				}
				catch (Exception)
				{
					//couldn't delete it? then increment the suffix and try again
				}
			}
			return path;
		}


		private void AddStylesheetClasses(XmlDocument dom)
		{
			if (this.GetPrintingWithFullBleed())
			{
				HtmlDom.AddClassToBody(dom, "publishingWithFullBleed");
			}
			else
			{
				HtmlDom.AddClassToBody(dom, "publishingWithoutFullBleed");
			}
			HtmlDom.AddPublishClassToBody(dom);


			if (LayoutPagesForRightToLeft)
				HtmlDom.AddRightToLeftClassToBody(dom);
			HtmlDom.AddHidePlaceHoldersClassToBody(dom);
			if (CurrentBook.GetDefaultBookletLayoutMethod() == PublishModel.BookletLayoutMethod.Calendar)
			{
				HtmlDom.AddCalendarFoldClassToBody(dom);
			}
		}

		private bool LayoutPagesForRightToLeft
		{
			get { return CurrentBook.BookData.Language1.IsRightToLeft; }
		}

		private bool GetPrintingWithFullBleed()
		{
			return CurrentBook.FullBleed && GetBookletLayoutMethod() == PublishModel.BookletLayoutMethod.NoBooklet && CurrentBook.UserPrefs.FullBleed;
		}

		private PublishModel.BookletLayoutMethod GetBookletLayoutMethod()
		{
			PublishModel.BookletLayoutMethod layoutMethod;
			if (this.BookletPortion == PublishModel.BookletPortions.AllPagesNoBooklet)
				layoutMethod = PublishModel.BookletLayoutMethod.NoBooklet;
			else
				layoutMethod = CurrentBook.GetBookletLayoutMethod(PageLayout);
			return layoutMethod;
		}

		private void ClipBookToRemoveFullBleed(HtmlDom dom)
		{
			// example: A5 book is full bleed. What the user saw and configured in Edit mode is RA5 paper, 3mm larger on each side.
			// But we're not printing for full bleed. We will create an A5 page with no inset trim box.
			// We want it to hold the trim box part of the RA5 page.
			// to do this, we simply need to move the bloom-page element up and left by 3mm. Clipping to the page will do the rest.
			// It would be more elegant to do this by introducing a CSS rule involving .bloom-page, but to introduce a new stylesheet
			// we have to make it findable in the book folder, which is messy. Or, we could add a stylesheet element to the DOM;
			// but that's messy, too, we need stuff like /*<![CDATA[*/ to make the content survive the trip from XML to HTML.
			// So it's easiest just to stick it in the style attribute of each page.
			foreach (var page in dom.SafeSelectNodes("//div[contains(@class, 'bloom-page')]").Cast<XmlElement>())
			{
				page.SetAttribute("style", "margin-left: -3mm; margin-top: -3mm;");
			}
		}
	}
}
