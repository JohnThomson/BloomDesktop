using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using Bloom;
using Bloom.Book;

namespace MakeFolioBook
{
	// First command line argument is the path to the HTM file of an existing bloom book
	// Second argument is the path to a nonexistent folder where the project for the folio book
	// should be created.
	// Currently arbitrarily divides the book into 10 child books with roughly equal numbers of pages.
	// See init of bookCount variable.
	// All the books have the same XMatter. This unfortunately means Bloom considers them all
	// to have the same title, and therefore the same name in the collection tab. Fixing this would be
	// the next enhancement.
	// Currently copies all files in the book folder except jpg and png to each book. Images are copied
	// to the folder where they are needed. Also audio files. Video not yet handled, but could be easily.
	// Also makes the folio book, with no pages (except xmatter) but the folio tag.
	// Also copies all files (not folders) in the collection folder to the new output folder.
	class Program
	{
		static void Main(string[] args)
		{
			var inputPath = args[0]; // bloom HTML file
			var info = new BookInfo(inputPath, false);
			var outputFolder = args[1];
			Directory.CreateDirectory(outputFolder);
			var sourceFolder = Path.GetDirectoryName(inputPath);
			var bookDom = XmlHtmlConverter.GetXmlDomFromHtml(File.ReadAllText(inputPath, Encoding.UTF8));
			int bookCount = 10; // how many folio books; could be arg
			var pages = bookDom.SelectNodes("/html/body//div[contains(@class, 'bloom-page') and not(contains(@class,'bloom-frontMatter')) and not(contains(@class,'bloom-backMatter'))]").Cast<XmlElement>().ToArray();
			int booksLeft = bookCount;
			int nextPage = 0;
			var bookFile = Path.GetFileNameWithoutExtension(inputPath);

			for (int bookIndex = 0, pagesLeft = pages.Length; pagesLeft > 0; bookIndex++)
			{
				int pagesInBook = Math.Max(pagesLeft / booksLeft, 1);
				booksLeft--;
				foreach (var page in pages.Take(nextPage))
				{
					page.ParentNode.RemoveChild(page);
				}

				nextPage += pagesInBook;
				pagesLeft -= pagesInBook;
				foreach (var page in pages.Skip(nextPage))
				{
					page.ParentNode.RemoveChild(page);
				}

				var bookFolder = Path.Combine(outputFolder, bookFile + bookIndex);
				Directory.CreateDirectory(bookFolder);
				var bookName = Path.Combine(bookFolder, bookFile + bookIndex + ".htm");
				var title = bookDom.SelectSingleNode("/html/head/title");
				if (title != null)
				{
					title.InnerText = bookFile + bookIndex; // make it match the file name
				}
				var output = XmlHtmlConverter.ConvertDomToHtml5(bookDom);
				File.WriteAllText(bookName, output, Encoding.UTF8);

				CopySupportFiles(sourceFolder, bookFolder, bookDom);

				bookDom = XmlHtmlConverter.GetXmlDomFromHtml(File.ReadAllText(inputPath, Encoding.UTF8));
				pages = bookDom.SelectNodes("/html/body//div[contains(@class, 'bloom-page') and not(contains(@class,'bloom-frontMatter')) and not(contains(@class,'bloom-backMatter'))]").Cast<XmlElement>().ToArray();
			}

			// make the folio book
			foreach (var page in pages)
			{
				page.ParentNode.RemoveChild(page);
			}

			var head = bookDom.DocumentElement.GetElementsByTagName("head")[0];
			var meta = bookDom.CreateElement("meta");
			head.AppendChild(meta);
			meta.SetAttribute("name", "folio");
			meta.SetAttribute("content", "true");

			var folioFolder = Path.Combine(outputFolder, bookFile);
			Directory.CreateDirectory(folioFolder);
			var folioName = Path.Combine(folioFolder, bookFile + ".htm");
			File.WriteAllText(folioName, XmlHtmlConverter.ConvertDomToHtml5(bookDom), Encoding.UTF8);

			CopySupportFiles(sourceFolder, folioFolder, bookDom);

			var collectionFolder = Path.GetDirectoryName(sourceFolder);
			foreach (var file in Directory.EnumerateFiles(collectionFolder))
			{
				File.Copy(file, Path.Combine(outputFolder, Path.GetFileName(file)));
			}
		}

		private static void CopySupportFiles(string sourceFolder, string bookFolder, XmlDocument bookDom)
		{
// Copy all files except images, audio, video
			var unwantedExtension = new HashSet<string>(new[] {".htm", ".jpg", ".png", ".wav", ".mp3"});
			foreach (var file in Directory.EnumerateFiles(sourceFolder))
			{
				if (unwantedExtension.Contains(Path.GetExtension(file)))
					continue;
				File.Copy(file, Path.Combine(bookFolder, Path.GetFileName(file)));
			}

			foreach (var file in BookStorage.GetImagePathsRelativeToBook(bookDom.DocumentElement))
			{
				var path = Path.Combine(sourceFolder, file);
				if (File.Exists(path))
					File.Copy(path, Path.Combine(bookFolder, file), true);
			}

			var audioFolder = Path.Combine(bookFolder, "audio");
			Directory.CreateDirectory(audioFolder);
			foreach (var file in BookStorage.GetBackgroundMusicFileNamesReferencedInBook(bookDom.DocumentElement)
				.Concat(BookStorage.GetNarrationAudioFileNamesReferencedInBook(bookDom.DocumentElement, true, true)))
			{
				var path = Path.Combine(sourceFolder, file);
				if (File.Exists(path))
					File.Copy(path, Path.Combine(audioFolder, file));
			}
		}
	}
}
