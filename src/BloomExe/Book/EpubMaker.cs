using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Xml;
using System.Xml.Linq;
using Palaso.IO;
using Palaso.Xml;

namespace Bloom.Book
{
	public class EpubMaker
	{
		private readonly Book _book;
		private readonly IBookStorage _storage;
		private HashSet<string> _idsUsed = new HashSet<string>();
		private Dictionary<string, string> _mapItemToId = new Dictionary<string, string>();
		private Dictionary<string, string>  _mapSrcPathToDestFileName = new Dictionary<string, string>();
		Dictionary<string, string> _mapChangedFileNames = new Dictionary<string, string>();
		private List<string> _manifestItems;
		private List<string> _spineItems;
		private string _firstContentPageItem;
		private string _coverPage;
		private string _contentFolder;
		private string _navFileName;

		/// <summary>
		/// Set to true for unpaginated output.
		/// </summary>
		public bool Unpaginated { get; set; }

		public EpubMaker(Book book)
		{
			_book = book;
			_storage = _book.Storage;
		}

		public void SaveEpub(string destinationEpubPath)
		{
			var stagingDirectory = Path.Combine(Path.GetDirectoryName(destinationEpubPath),
				Path.GetFileNameWithoutExtension(destinationEpubPath));
			{
				if (Directory.Exists(stagingDirectory))
					Directory.Delete(stagingDirectory, true);
						// in case of previous versions // Enhance: delete when done? Generate new name if conflict?
				var contentFolderName = "content";
				_contentFolder = Path.Combine(stagingDirectory, contentFolderName);
				Directory.CreateDirectory(_contentFolder); // also creates parent staging directory
				var pageIndex = 0;
				_manifestItems = new List<string>();
				_spineItems = new List<string>();
				int firstContentPageIndex = _book.GetIndexLastFrontkMatterPage() + 2; // pageIndex starts at 1
				_firstContentPageItem = null;
				foreach (XmlElement pageElement in _book.GetPageElements())
				{
					//var id = pageElement.GetAttribute("id");

					++pageIndex;
					var pageDom = GetEpubFriendlyHtmlDomForPage(pageElement);
					pageDom.RemoveModeStyleSheets();
					if (Unpaginated)
					{
						RemoveRegularStylesheets(pageDom);
						pageDom.AddStyleSheet(_storage.GetFileLocator().LocateFileWithThrow(@"epubUnpaginated.css").ToLocalhost());
					}
					else
					{
						pageDom.AddStyleSheet(_storage.GetFileLocator().LocateFileWithThrow(@"basePage.css").ToLocalhost());
						pageDom.AddStyleSheet(_storage.GetFileLocator().LocateFileWithThrow(@"previewMode.css"));
						pageDom.AddStyleSheet(_storage.GetFileLocator().LocateFileWithThrow(@"origami.css"));
					}

					RemoveUnwantedContent(pageDom);

					pageDom.SortStyleSheetLinks();
					pageDom.AddPublishClassToBody();

					MakeCssLinksAppropriateForEpub(pageDom);
					RemoveSpuriousLinks(pageDom);
					RemoveScripts(pageDom);
					FixIllegalIds(pageDom);
					// Since we only allow one htm file in a book folder, I don't think there is any
					// way this name can clash with anything else.
					var pageDocName = pageIndex + ".xhtml";

					// Manifest has to include all referenced files
					foreach (XmlElement img in pageDom.SafeSelectNodes("//img"))
					{
						var srcAttr = img.Attributes["src"];
						if (srcAttr == null)
							continue; // hug?
						var imgName = srcAttr.Value;
						// Images are always directly in the folder
						var srcPath = Path.Combine(_book.FolderPath, imgName);
						CopyFileToEpub(srcPath);
					}

					_manifestItems.Add(pageDocName);
					_spineItems.Add(pageDocName);

					// for now, at least, all Bloom book pages currently have the same stylesheets, so we only neeed
					//to look at those stylesheets on the first page
					if (pageIndex == 1)
					{
						_coverPage = pageDocName;
						//css
						foreach (XmlElement link in pageDom.SafeSelectNodes("//link[@rel='stylesheet']"))
						{
							var href = Path.Combine(_book.FolderPath, link.GetAttribute("href"));
							var name = Path.GetFileName(href);

							var fl = _book.Storage.GetFileLocator();
							//var path = this.GetFileLocator().LocateFileWithThrow(name);
							var path = fl.LocateFileWithThrow(name);
							CopyFileToEpub(path);
						}
					}
					if (pageIndex == firstContentPageIndex)
						_firstContentPageItem = pageDocName;

					FixChangedFileNames(pageDom);

					// epub validator requires HTML to use namespace. Do this last to avoid (possibly?) messing up our xpaths.
					pageDom.RawDom.DocumentElement.SetAttribute("xmlns", "http://www.w3.org/1999/xhtml");
					File.WriteAllText(Path.Combine(_contentFolder, pageDocName), pageDom.RawDom.OuterXml);

				}

				MakeNavPage();


				//supporting files

				// Fixed requirement for all epubs
				File.WriteAllText(Path.Combine(stagingDirectory, "mimetype"), @"application/epub+zip");

				var metaInfFolder = Path.Combine(stagingDirectory, "META-INF");
				Directory.CreateDirectory(metaInfFolder);
				var containerXmlPath = Path.Combine(metaInfFolder, "container.xml");
				File.WriteAllText(containerXmlPath, @"<?xml version='1.0' encoding='utf-8'?>
					<container version='1.0' xmlns='urn:oasis:names:tc:opendocument:xmlns:container'>
					<rootfiles>
					<rootfile full-path='content/content.opf' media-type='application/oebps-package+xml'/>
					</rootfiles>
					</container>");

				// content.opf
				var contentOpfPath = Path.Combine(_contentFolder, "content.opf");
				XNamespace opf = "http://www.idpf.org/2007/opf";
				var rootElt = new XElement(opf + "package",
					new XAttribute("version", "3.0"),
					new XAttribute("unique-identifier", "I" + _book.ID));
				// add metadata
				var dcNamespace = "http://purl.org/dc/elements/1.1/";
				XNamespace dc = dcNamespace;
				var metadataElt = new XElement(opf + "metadata",
					new XAttribute(XNamespace.Xmlns + "dc", dcNamespace),
					// attribute makes the namespace have a prefix, not be a default.
					new XElement(dc + "title", _book.Title),
					new XElement(dc + "language", _book.CollectionSettings.Language1Iso639Code),
					new XElement(dc + "identifier",
						new XAttribute("id", "I" + _book.ID), "bloomlibrary.org." + _book.ID),
					new XElement(opf + "meta",
						new XAttribute("property", "dcterms:modified"),
						new FileInfo(_storage.FolderPath).LastWriteTimeUtc.ToString("s") + "Z")); // like 2012-03-20T11:37:00Z
				rootElt.Add(metadataElt);

				var manifestElt = new XElement(opf + "manifest");
				rootElt.Add(manifestElt);
				foreach (var item in _manifestItems)
				{
					var itemElt = new XElement(opf + "item",
						new XAttribute("id", GetIdOfFile(item)),
						new XAttribute("href", item),
						new XAttribute("media-type", GetMediaType(item)));
					// For now we will mark the first content page as the 'nav' page...
					// as good a place as we can send users to for navigating around a bloom book.
					// This isn't very useful but satisfies a validator requirement until we think of
					// something better.
					if (item == _navFileName)
						itemElt.SetAttributeValue("properties", "nav");
					manifestElt.Add(itemElt);
				}
				var spineElt = new XElement(opf + "spine");
				rootElt.Add(spineElt);
				foreach (var item in _spineItems)
				{
					var itemElt = new XElement(opf + "itemref",
						new XAttribute("idref", GetIdOfFile(item)));
					spineElt.Add(itemElt);
				}
				using (var writer = XmlWriter.Create(contentOpfPath))
					rootElt.WriteTo(writer);

				var zip = new BloomZipFile(destinationEpubPath);
				foreach (var file in Directory.GetFiles(stagingDirectory))
					zip.AddTopLevelFile(file);
				foreach (var dir in Directory.GetDirectories(stagingDirectory))
					zip.AddDirectory(dir);
				zip.Save();
			}
		}

		/// <summary>
		/// Remove stuff that we don't want displayed. Some e-readers don't obey display:none. Also, not shipping it saves space.
		/// </summary>
		/// <param name="pageDom"></param>
		private void RemoveUnwantedContent(HtmlDom pageDom)
		{
			// Remove bloom-editable material not in one of the interesting languages
			foreach (XmlElement elt in pageDom.RawDom.SafeSelectNodes("//div").Cast<XmlElement>().ToArray())
			{
				if (!HasClass(elt, "bloom-editable"))
					continue;
				var langAttr = elt.Attributes["lang"];
				var lang = langAttr == null ? null : langAttr.Value;
				if (lang == _book.MultilingualContentLanguage2 || lang == _book.MultilingualContentLanguage3 ||
					lang == _book.CollectionSettings.Language1Iso639Code)
					continue; // keep these
				if (lang == _book.CollectionSettings.Language2Iso639Code && IsInXMatterPage(elt))
					continue;
				elt.ParentNode.RemoveChild(elt);
			}
			// Remove and left-over bubbles
			foreach (XmlElement elt in pageDom.RawDom.SafeSelectNodes("//label").Cast<XmlElement>().ToArray())
			{
				if (HasClass(elt, "bubble"))
					elt.ParentNode.RemoveChild(elt);
			}
			// Remove page labels
			foreach (XmlElement elt in pageDom.RawDom.SafeSelectNodes("//div").Cast<XmlElement>().ToArray())
			{
				if (HasClass(elt, "pageLabel"))
					elt.ParentNode.RemoveChild(elt);
			}
		}

		private bool IsInXMatterPage(XmlElement elt)
		{
			while (elt != null)
			{
				if (HasClass(elt, "bloom-page"))
					return HasClass(elt, "bloom-frontMatter") || HasClass(elt, "bloom-backMatter");
				elt = elt.ParentNode as XmlElement;
			}
			return false;
		}

		bool HasClass(XmlElement elt, string className)
		{
			var classAttr = elt.Attributes["class"];
			if (classAttr == null)
				return false;
			return ((" " + classAttr.Value + " ").Contains(" " + className + " "));
		}

		private void RemoveRegularStylesheets(HtmlDom pageDom)
		{
			foreach (XmlElement link in pageDom.RawDom.SafeSelectNodes("//head/link").Cast<XmlElement>().ToArray())
			{
				var href = link.Attributes["href"];
				if (href != null && href.Value.StartsWith("custom"))
					continue;
				link.ParentNode.RemoveChild(link);
			}
		}

		private void FixChangedFileNames(HtmlDom pageDom)
		{
			foreach (var attr in new[] {"src", "href"})
			{
				foreach (var node in pageDom.RawDom.SafeSelectNodes("//*[@" + attr + "]"))
				{
					var elt = node as XmlElement;
					if (elt == null)
						continue;
					var oldName = elt.Attributes[attr].Value;
					string newName;
					if (_mapChangedFileNames.TryGetValue(oldName, out newName))
						elt.SetAttribute(attr, newName);
				}
			}
		}

		private void CopyFileToEpub(string srcPath)
		{
			if (_mapSrcPathToDestFileName.ContainsKey(srcPath))
				return; // File already present, must be used more than once.
			// Validator warns against spaces in filenames.
			var originalFileName = Path.GetFileName(srcPath);
			string fileName = originalFileName.Replace(" ", "_");
			var dstPath = Path.Combine(_contentFolder, fileName);
			// We deleted the root directory at the start, so if the file is already
			// there it is a clash, either multiple sources for files with the same name,
			// or produced by replacing spaces, or something. Come up with a similar unique name.
			for (int fix = 1; File.Exists(dstPath); fix++)
			{
				fileName = fileName + fix;
				dstPath = Path.Combine(_contentFolder, fileName);
			}
			if (originalFileName != fileName)
				_mapChangedFileNames[originalFileName] = fileName;
			CopyFile(srcPath, dstPath);
			_manifestItems.Add(fileName);
			_mapSrcPathToDestFileName[srcPath] = fileName;
		}

		internal virtual void CopyFile(string srcPath, string dstPath)
		{
			File.Copy(srcPath, dstPath);
		}

		// The validator is (probably excessively) upset about IDs that start with numbers.
		// I don't think we actually use these IDs in the epub so maybe we should just remove them?
		private void FixIllegalIds(HtmlDom pageDom)
		{
			foreach (var node in pageDom.RawDom.SafeSelectNodes("//*[@id]"))
			{
				var elt = node as XmlElement;
				if (elt == null)
					continue;
				var id = elt.Attributes["id"].Value;
				var first = id[0];
				if (first >= '0' && first <= '9')
					elt.SetAttribute("id", "i" + id);
			}
		}

		private void MakeNavPage()
		{
			XNamespace xhtml = "http://www.w3.org/1999/xhtml";
			// Todo: improve this or at least make a way "Cover" and "Content" can be put in the book's language.
			var content = XElement.Parse(@"
<html xmlns='http://www.w3.org/1999/xhtml' xmlns:epub='http://www.idpf.org/2007/ops'>
	<head>
		<meta charset='utf-8' />
	</head>
	<body>
		<nav epub:type='toc' id='toc'>
			<ol>
				<li><a>Cover</a></li>
				<li><a>Content</a></li>
			</ol>
		</nav>
	</body>
</html>");
			var ol = content.Element(xhtml + "body").Element(xhtml + "nav").Element(xhtml + "ol");
			var items = ol.Elements(xhtml + "li").ToArray();
			var coverItem = items[0];
			var contentItem = items[1];
			if (_firstContentPageItem == null)
				contentItem.Remove();
			else
				contentItem.Element(xhtml + "a").SetAttributeValue("href", _firstContentPageItem);
			if (_coverPage == _firstContentPageItem)
				coverItem.Remove();
			else
				coverItem.Element(xhtml + "a").SetAttributeValue("href", _coverPage);
			_navFileName = "nav.xhtml";
			var navPath = Path.Combine(_contentFolder, _navFileName);

			using (var writer = XmlWriter.Create(navPath))
				content.WriteTo(writer);
			_manifestItems.Add(_navFileName);
		}

		/// <summary>
		/// We don't need to make scriptable books, and if our html contains scripts
		/// (which probably won't work on most readers) we have to add various attributes.
		/// Also our scripts are external refs, which would have to be fixed.
		/// </summary>
		/// <param name="pageDom"></param>
		private void RemoveScripts(HtmlDom pageDom)
		{
			foreach (var node in pageDom.RawDom.SafeSelectNodes("//script").Cast<XmlNode>().ToArray())
			{
				var elt = node as XmlElement;
				if (elt == null)
					continue;
				elt.ParentNode.RemoveChild(elt);
			}
		}

		/// <summary>
		/// Clean up any dangling pointers and similar spurious data.
		/// </summary>
		/// <param name="pageDom"></param>
		private void RemoveSpuriousLinks(HtmlDom pageDom)
		{
			// The validator has complained about area-describedby where the id is not found.
			// I don't think we will do qtips at all in books so let's just remove these altogether for now.
			foreach (var node in pageDom.RawDom.SafeSelectNodes("//*[@aria-describedby]"))
			{
				var elt = node as XmlElement;
				if (elt == null)
					continue;
				elt.RemoveAttribute("aria-describedby");
			}

			// Validator doesn't like empty lang attributes, and they don't convey anything useful, so remove.
			foreach (var node in pageDom.RawDom.SafeSelectNodes("//*[@lang='']"))
			{
				var elt = node as XmlElement;
				if (elt == null)
					continue;
				elt.RemoveAttribute("lang");
			}
			// Validator doesn't like '*' as value of lang attributes, and they don't convey anything useful, so remove.
			foreach (var node in pageDom.RawDom.SafeSelectNodes("//*[@lang='*']"))
			{
				var elt = node as XmlElement;
				if (elt == null)
					continue;
				elt.RemoveAttribute("lang");
			}
		}

		/// <summary>
		/// Since file names often start with numbers, which epub validation won't allow for element IDs,
		/// stick an 'f' in front.
		/// </summary>
		/// <param name="item"></param>
		/// <returns></returns>
		private string GetIdOfFile(string item)
		{
			string id;
			if (_mapItemToId.TryGetValue(item, out id))
				return id;
			// Attempt to use file name as ID for recognizability
			// Remove spaces which are illegal in XML IDs.
			// Add initial letter to avoid starting with digit
			id = "f" + Path.GetFileNameWithoutExtension(item).Replace(" ", "");
			var idOriginal = id;
			for (int i = 1; _idsUsed.Contains(id.ToLowerInvariant()); i++)
			{
				// Somehow we made a clash
				id = idOriginal + i;
			}
			_idsUsed.Add(id.ToLowerInvariant());
			_mapItemToId[item] = id;

			return id;
		}

		private object GetMediaType(string item)
		{
			switch (Path.GetExtension(item).Substring(1))
			{
				case "xml": // Review
				case "xhtml":
					return "application/xhtml+xml";
				case "jpg":
				case "jpeg":
					return "image/jpeg";
				case "png":
					return "image/png";
				case "css":
					return "text/css";

			}
			throw new ApplicationException("unexpected file type in file " + item);
		}

		private static void MakeCssLinksAppropriateForEpub(HtmlDom dom)
		{
			dom.RemoveModeStyleSheets();
			dom.SortStyleSheetLinks();
			dom.RemoveFileProtocolFromStyleSheetLinks();
			dom.RemoveDirectorySpecificationFromStyleSheetLinks();
		}

		private HtmlDom GetEpubFriendlyHtmlDomForPage(XmlElement page)
		{
			var headXml = _storage.Dom.SelectSingleNodeHonoringDefaultNS("/html/head").OuterXml;
			var dom = new HtmlDom(@"<html>" + headXml + "<body></body></html>");
			dom = _storage.MakeDomRelocatable(dom);
			var body = dom.RawDom.SelectSingleNodeHonoringDefaultNS("//body");
			var pageDom = dom.RawDom.ImportNode(page, true);
			body.AppendChild(pageDom);
			return dom;
		}
	}
}