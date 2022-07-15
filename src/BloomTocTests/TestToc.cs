using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bloom.Book;
using BloomTests;
using BloomToc;
using NUnit.Framework;

namespace BloomTocTests
{
	[TestFixture]
    public class TestToc
    {
	    [Test]
	    public void UpdateToc_NoTocPage_DoesNothing()
	    {
		    var html = @"<html><head></head>
				<body>
					<div class='bloom-page bloom-frontMatter'>
						
					</div>
				</body></html>";
		    var dom = new HtmlDom(html);

		    TocMaker.UpdateToc(dom);

			// Enahnce: how do we check it did nothing??
	    }

		string BasicTocPage(string extraRowTemplateContent = "", string extraTemplateContent="")
	    {
		    return @"
				<div class='bloom-page A5Portrait bloom-toc-template' id='F6ED105B-3745-4A2C-A4DA-27C01CE04AD5' data-max-toc-rows-on-page='3'>
					<div class='bloom-toc-row-template'>
						<div class='tocItem' data-toc-match='h1'><p>this should go</p></div>" + extraRowTemplateContent + @"
						<div class='bloom-toc-page-number'></div>
					</div>"
				   + extraTemplateContent +
				@"</div>";
	    }

	    string EnglishContent1DataDiv()
	    {
		    return @"
				<div id='bloomDataDiv'>
					<div data-book='contentLanguage1' lang='*'>
						en
					</div>
				</div>";

	    }

	    [Test]
	    public void UpdateToc_Toc_OneTitleElement_MakesOneRow()
	    {
		    var html = @"<html><head></head>
				<body>"
					+ EnglishContent1DataDiv()
					+ BasicTocPage()
					+ @"
					<div class='bloom-page' data-page-number='7'>
						<h1 class='h1' lang='en'>first heading</h1>
					</div>
				</body></html>";
		    var dom = new HtmlDom(html);

		    TocMaker.UpdateToc(dom);

		    var assertThatResult = AssertThatXmlIn.Dom(dom.RawDom);
			assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[contains(@class,'bloom-toc-template')]/div[@class='bloom-toc-row-template']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem' and @lang='en' and text() = 'first heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='bloom-toc-page-number' and text() = '7']", 1);
		}


	    [Test]
	    public void UpdateToc_Toc_ReplacesOldToc()
	    {
		    var html = @"<html><head></head>
				<body>"
		               + EnglishContent1DataDiv()
		               + BasicTocPage(extraTemplateContent:"<div class='bloom-toc oldToc'></div>")
		               + @"
					<div class='bloom-page' data-page-number='7'>
						<h1 class='h1' lang='en'>first heading</h1>
					</div>
				</body></html>";
		    var dom = new HtmlDom(html);

		    TocMaker.UpdateToc(dom);

		    var assertThatResult = AssertThatXmlIn.Dom(dom.RawDom);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[contains(@class,'bloom-toc-template')]/div[@class='bloom-toc-row-template']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem' and @lang='en' and text() = 'first heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='bloom-toc-page-number' and text() = '7']", 1);
			assertThatResult.HasNoMatchForXpath("//div[@class='bloom-toc oldToc']");
	    }

		[Test]
	    public void UpdateToc_Toc_ThreeTitleElements_PlusOtherLangs_MakesThreeRows()
	    {
		    var html = @"<html><head></head>
				<body>"
		               + EnglishContent1DataDiv()
		               + BasicTocPage()
		               + @"
					<div class='bloom-page' data-page-number='1'>
						<h1 class='h1' lang='en'>first heading</h1>
					</div>
					<div class='bloom-page' data-page-number='2'>
						<h1 class='h1' lang='en'>second heading</h1>
						<h1 class='h1' lang='fr'>french heading</h1>
						<h1 class='h1' lang='en'>third <b>heading</b> has bold</h1>
					</div>
				</body></html>";
			var dom = new HtmlDom(html);

		    TocMaker.UpdateToc(dom);

		    var assertThatResult = AssertThatXmlIn.Dom(dom.RawDom);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[contains(@class,'bloom-toc-template')]/div[@class='bloom-toc-row-template']", 1);
			// got main headings
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem']", 3);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem' and @lang='en' and text() = 'first heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem' and @lang='en' and text() = 'second heading']", 1);
		    // Should be possible to do this with xpath but I can't figure it.
		    var thirdToc =
			    dom.SelectSingleNode(
				    "//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem' and @lang='en']/b[text() = 'heading']");
		    Assert.That(thirdToc, Is.Not.Null);
		    Assert.That(thirdToc.ParentNode.InnerText, Is.EqualTo("third heading has bold"));
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='bloom-toc-page-number' and text() = '1']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='bloom-toc-page-number' and text() = '2']", 2);
		}

		[Test]
		public void UpdateToc_Toc_ManyTitleElements_MakesExtraPages_WithDataBookLinks()
		{
			var html = @"<html><head></head>
				<body>"
					   + EnglishContent1DataDiv()
					   + BasicTocPage()
					   + @"
					<div class='bloom-page' data-page-number='1'>
						<h1 class='h1' lang='en'>first heading</h1>
					</div>
					<div class='bloom-page' data-page-number='2'>
						<h1 class='h1' lang='en'>second heading</h1>
						<h1 class='h1' lang='en'>third heading</h1>
					</div>
					<div class='bloom-page' data-page-number='3'>
						<h1 class='h1' lang='en'>fourth heading</h1>
						<h1 class='h1' lang='en'>fifth heading</h1>
						<h1 class='h1' lang='en'>sixth heading</h1>
						<h1 class='h1' lang='en'>seventh heading</h1>
					</div>
				</body></html>";
			var dom = new HtmlDom(html);

			TocMaker.UpdateToc(dom);

			CheckManyTocPageResults(dom);

			// Doing it again and checking for the same results confirms all kinds of cleanup,
			// especially that the extra pages made the first time are not replicated.
			TocMaker.UpdateToc(dom);

			CheckManyTocPageResults(dom);
		}

	    private static void CheckManyTocPageResults(HtmlDom dom)
	    {
		    var assertThatResult = AssertThatXmlIn.Dom(dom.RawDom);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath(
			    "//div[contains(@class,'bloom-toc-template')]/div[@class='bloom-toc-row-template']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath(
			    "//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem']", 7);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath(
			    "//div[contains(@class, 'bloom-toc-template')]//div[@class='bloom-toc']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath(
			    "//div[contains(@class, 'bloom-toc-extra')]//div[@class='bloom-toc']", 2);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row' and @data-toc-row-number='1']/div[@class='tocItem' and @lang='en' and @data-book='toc1' and text() = 'first heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row' and @data-toc-row-number='2']/div[@class='tocItem' and @lang='en' and @data-book='toc2' and text() = 'second heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row' and @data-toc-row-number='3']/div[@class='tocItem' and @lang='en' and @data-book='toc3' and text() = 'third heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row' and @data-toc-row-number='5']/div[@class='tocItem' and @lang='en' and @data-book='toc5' and text() = 'fifth heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row' and @data-toc-row-number='7']/div[@class='tocItem' and @lang='en' and @data-book='toc7' and text() = 'seventh heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath(
			    "//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='bloom-toc-page-number' and text() = '1']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath(
			    "//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='bloom-toc-page-number' and text() = '2']", 2);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath(
			    "//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='bloom-toc-page-number' and text() = '3']", 4);
			// data-book added to real pages
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@data-page-number='1']/h1[@class='h1' and @data-book='toc1' and text() = 'first heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@data-page-number='3']/h1[@class='h1' and @data-book='toc6' and text() = 'sixth heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@data-page-number='3']/h1[@class='h1' and @data-book='toc5' and text() = 'fifth heading']", 1);

			var tocTemplatePages = dom.RawDom.SelectNodes("//div[contains(@class,'bloom-toc-template')]");
			Assert.That(tocTemplatePages, Has.Count.EqualTo(1));
			var tocExtraPages = dom.RawDom.SelectNodes("//div[contains(@class,'bloom-toc-extra')]");
			Assert.That(tocExtraPages, Has.Count.EqualTo(2));
			Assert.That(tocTemplatePages[0].Attributes["id"].Value, Is.Not.EqualTo(tocExtraPages[0].Attributes["id"].Value));
			Assert.That(tocTemplatePages[0].Attributes["id"].Value, Is.Not.EqualTo(tocExtraPages[1].Attributes["id"].Value));
			Assert.That(tocExtraPages[0].Attributes["id"].Value, Is.Not.EqualTo(tocExtraPages[1].Attributes["id"].Value));
		}


		[Test]
	    public void UpdateToc_SecondaryMatches_IncludesItemsExpected()
	    {
		    var html = @"<html><head></head>
				<body>"
		               + EnglishContent1DataDiv()
		               + BasicTocPage("<div class='tocSubItem' data-toc-sub-match='h2'>this should usually go</div>")
		               + @"
					<div class='bloom-page' data-page-number='1'>
						<h1 class='h1' lang='en'>first heading</h1>
						<div class='h2' lang='en'>first subheading</div>
						<div class='h2' lang='en'>ignored...not the first following h1</div>
					</div>
					<div class='bloom-page' data-page-number='2'>
						<div class='h2' lang='en'>ignored...not the first following h1</div>
						<h1 class='h1' lang='en'>second heading</h1>
						<h1 class='h1' lang='en'>third heading</h1>
					</div>
					<div class='bloom-page' data-page-number='3'>
						<div class='h2' lang='en'>subheading for third heading</div>
					</div>
				</body></html>";
		    var dom = new HtmlDom(html);

		    TocMaker.UpdateToc(dom);

		    var assertThatResult = AssertThatXmlIn.Dom(dom.RawDom);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[contains(@class,'bloom-toc-template')]/div[@class='bloom-toc-row-template']", 1);
		    // got rows for English headings, not French.
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem']", 3);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem' and @lang='en' and @data-book='toc1' and text() = 'first heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem' and @lang='en' and @data-book='toc2' and text() = 'second heading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocItem' and @lang='en' and @data-book='toc3' and text() = 'third heading']", 1);
		    // we do clone tocSubItem for second heading, but put nothing in it
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocSubItem']", 3);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocSubItem' and @lang='en' and @data-book='tocSub1' and text() = 'first subheading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocSubItem' and text() = 'this should usually go']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='tocSubItem' and @lang='en' and @data-book='tocSub3' and text() = 'subheading for third heading']", 1);
		    // data-book added to real pages
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@data-page-number='1']/div[@class='h2' and @data-book='tocSub1' and text() = 'first subheading']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath("//div[@data-page-number='3']/div[@class='h2' and @data-book='tocSub3' and text() = 'subheading for third heading']", 1);

		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath(
			    "//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='bloom-toc-page-number' and text() = '1']", 1);
		    assertThatResult.HasSpecifiedNumberOfMatchesForXpath(
			    "//div[@class='bloom-toc']/div[@class='bloom-toc-row']/div[@class='bloom-toc-page-number' and text() = '2']", 2);
	    }
	}


}
