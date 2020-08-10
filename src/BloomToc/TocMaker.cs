using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using Bloom.Book;
using Bloom.ToPalaso;

namespace BloomToc
{
	/// <summary>
	/// This class makes a table of contents for a bloom book, based on a template page which can optionally be inserted
	/// Properties of a TocPage:
	/// - div with class bloom-page also has class bloom-toc-template
	/// - div within page has class bloom-toc-row-template.
	///		- This will be display:none in the output
	///		- a div with class bloom-toc will be inserted after it if a TOC is needed
	///		- each row of TOC starts out as a clone of row template, but with class bloom-toc-row
	///		- each bloom-toc-row has data-toc-row-number with a sequence number, increasing from 1 across all TOC pages
	/// - div inside row template has data-toc-match
	///		- one row is made in TOC for each element in the document that has the data-toc-match class and the book's bloom-content1 language.
	///		- the content of the data-toc-match element in the TOC row will be replaced with a clone of the content of the node that caused it to exist
	///			(Considered appending, but a typical pattern has an empty paragraph we want to get rid of.)
	///		- tocRowTemplate may also have data-toc-sub-match. If so, its content has appended the content of the first
	///			element between the corresponding tocMatch class and the next one which has the right class and language.
	///			If none is found, the data-toc-sub-match element remains in the toc-row, but its contents are not replaced.
	///		- toc-row-template may have an element with class bloom-toc-page-number. The number of the page on which
	///			the toc-match element was found will be appended to this.
	///  - bloom-toc-template page element may also have data-max-toc-rows-on-page. If more than this number of toc-rows are made,
	///		- additional copies of the toc-template page will be made. They will have the class bloom-toc-extra instead of bloom-toc-template.
	///			Each will be given a unique page ID.
	///  - before starting this process, any bloom-toc-extra pages and any bloom-toc element on the main template page
	///		will be removed.
	/// Note: it is expected that the element with class bloom-toc-row-template will be hidden by css display:none.
	/// Elememts which should only appear on the first TOC page may be hidden on follow-on pages by CSS rules
	/// using the bloom-toc-extra class on the page.
	/// Each toc item will be given a unique data-book value shared with the corresponding book element.
	/// This will allow Bloom to keep them in sync without re-running this tool, except when there is a new TOC entry.
	/// </summary>
	public class TocMaker
	{
		public static void UpdateToc(HtmlDom dom)
		{
			var tocTemplate =
				dom.RawDom.SelectSingleNode("//div[contains(@class, 'bloom-page') and contains(@class, 'bloom-toc-template')]");
			if (tocTemplate == null)
				return; // no toc
			// Delete any follow-on toc pages (typically from previous runs).
			foreach (XmlElement extraTocPage in dom.RawDom.SelectNodes("//*[contains(@class, 'bloom-toc-extra')]").Cast<XmlElement>().ToList())
			{
				extraTocPage.ParentNode.RemoveChild(extraTocPage);
			}
			var maxRowsOnPageStr = tocTemplate.Attributes["data-max-toc-rows-on-page"]?.Value;
			var maxRowsOnPage = int.MaxValue;
			if (maxRowsOnPageStr != null)
				int.TryParse(maxRowsOnPageStr, out maxRowsOnPage);
			if (maxRowsOnPage < 1)
			{
				maxRowsOnPage = int.MaxValue;
			}
			var rowTemplate = tocTemplate.SelectSingleNode(".//div[@class='bloom-toc-row-template']");
			if (rowTemplate == null)
				return;
			// delete any existing toc (template may have been applied before)
			var oldToc = tocTemplate.SelectSingleNode(".//*[contains(concat(' ', normalize-space(@class), ' '), ' bloom-toc ')]");
			oldToc?.ParentNode.RemoveChild(oldToc);
			var primaryMatch = rowTemplate.SelectSingleNode(".//div[@data-toc-match]");
			if (primaryMatch == null)
				return;
			var matchClass = primaryMatch.Attributes["data-toc-match"].Value;
			// Obtain the language we want from data div bloom-content1
			var langElt = dom.SelectSingleNode("//div[@id='bloomDataDiv']/div[@data-book='contentLanguage1']");
			var lang = langElt.InnerText.Trim();

			// get secondary match element, if any
			var secMatchXpath = "";
			var secMatch = rowTemplate.SelectSingleNode(".//div[@data-toc-sub-match]");
			if (secMatch != null)
			{
				secMatchXpath = " or contains(@class, '" + secMatch.Attributes["data-toc-sub-match"].Value + "')";
			}
			// The number of rows is determined by occurrences of elements with the right class and language (typically bloom-editable, but we don't enforce this).
			var headingsForToc = dom.SafeSelectNodes("//*[(contains(@class,'" + matchClass + "') " + secMatchXpath + ") and @lang='" + lang + "']").Cast<XmlElement>();
			if (!headingsForToc.Any())
				return;

			var toc = dom.RawDom.CreateElement("div");
			rowTemplate.ParentNode.InsertAfter(toc, rowTemplate);
			InitToc(toc);

			XmlElement tocRow = null;
			bool gotSecondary = true;
			int rowsOnPage = 0;
			int tocItem = 0;
			foreach (var heading in headingsForToc)
			{
				if (heading.Attributes["class"].Value.Contains(matchClass))
				{
					tocRow = (XmlElement) rowTemplate.CloneNode(true);
					// enhance: remove data-toc-match attr, and possibly data-toc-sub-match attr (save element first). Not important.
					tocRow.SetAttribute("class", "bloom-toc-row");
					rowsOnPage++;
					tocItem++;
					tocRow.SetAttribute("data-toc-row-number", tocItem.ToString());
					if (rowsOnPage > maxRowsOnPage)
					{
						rowsOnPage = 1;
						var extraPage = (XmlElement)tocTemplate.CloneNode(true);
						tocTemplate.ParentNode.InsertAfter(extraPage, tocTemplate);
						tocTemplate = extraPage; // so we can insert after it again
						extraPage.SetAttribute("class", extraPage.Attributes["class"].Value.Replace("bloom-toc-template", "bloom-toc-extra"));
						extraPage.SetAttribute("id", "i" + Guid.NewGuid());
						toc = (XmlElement) extraPage.SelectSingleNode(
							".//*[contains(concat(' ', normalize-space(@class), ' '), ' bloom-toc ')]");
						toc.RemoveAll(); // Don't want clones of the rows we already added!
						InitToc(toc);
						// We need to keep the row template in the primary template so we can run this again.
						// We don't need it in the extra pages.
						var extraRowTemplate = tocTemplate.SelectSingleNode(".//div[@class='bloom-toc-row-template']");
						extraRowTemplate?.ParentNode.RemoveChild(extraRowTemplate);
					}
					toc.AppendChild(tocRow);
					var rowMatch = (XmlElement) tocRow.SelectSingleNode(".//div[@data-toc-match]");
					rowMatch.SetAttribute("lang", lang);
					foreach (var child in rowMatch.ChildNodes.Cast<XmlNode>().ToArray())
						rowMatch.RemoveChild(child);
					foreach (XmlNode node in heading.ChildNodes)
					{
						rowMatch.AppendChild(node.CloneNode(true));
					}

					var dataBookKey = "toc" + tocItem;
					heading.SetAttribute("data-book", dataBookKey);
					rowMatch.SetAttribute("data-book", dataBookKey);
					gotSecondary = false;
					// page number
					var pageNumberElt = tocRow.SelectSingleNode(".//*[contains(@class, 'bloom-toc-page-number')]");
					var page = heading.ParentWithClass("bloom-page");
					var pageNum = page?.GetAttribute("data-page-number");
					if (pageNumberElt != null && !string.IsNullOrEmpty(pageNum))
						pageNumberElt.AppendChild(dom.RawDom.CreateTextNode(pageNum));
				}
				else if (!gotSecondary)
				{
					gotSecondary = true; // ignore further ones until primary
					var subMatch = (XmlElement)tocRow.SelectSingleNode(".//div[@data-toc-sub-match]");
					subMatch.SetAttribute("lang", lang);
					foreach (var child in subMatch.ChildNodes.Cast<XmlNode>().ToArray())
						subMatch.RemoveChild(child);
					foreach (XmlNode node in heading.ChildNodes)
					{
						subMatch.AppendChild(node.CloneNode(true));
					}
					var dataBookKey = "tocSub" + tocItem;
					heading.SetAttribute("data-book", dataBookKey);
					subMatch.SetAttribute("data-book", dataBookKey);
				}
			}

		}

		private static void InitToc(XmlElement toc)
		{
			toc.SetAttribute("class", "bloom-toc");
		}
	}
}
