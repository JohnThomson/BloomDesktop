﻿using System;
using System.Linq;
using System.Xml;
using Bloom;
using Bloom.Book;
using NUnit.Framework;
using SIL.Xml;

namespace BloomTests.Book
{
	[TestFixture]
	public sealed class HtmlDomTests
	{
		[Test]
		public void Title_EmptyDom_RoundTrips()
		{
			var dom = new HtmlDom();
			dom.Title = "foo";
			Assert.AreEqual("foo",dom.Title);
		}
		[Test]
		public void Title_CanChange()
		{
			var dom = new HtmlDom();
			dom.Title = "one";
			dom.Title = "two";
			Assert.AreEqual("two", dom.Title);
		}
		[Test]
		public void Title_HasHtml_Stripped()
		{
			var dom = new HtmlDom();
			dom.Title = "<b>one</b>1";
			Assert.AreEqual("one1", dom.Title);
		}

		[Test]
		public void BaseForRelativePaths_NoHead_NoLongerThrows()
		{
			var dom = new HtmlDom(
						  @"<html></html>");
			dom.BaseForRelativePaths = "theBase";
			Assert.AreEqual("theBase", dom.BaseForRelativePaths);
		}

		[Test]
		public void BaseForRelativePaths_NullPath_SetsToEmpty()
		{
			var dom = new HtmlDom(
						  @"<html><head><base href='original'/></head></html>");
			dom.BaseForRelativePaths = null;
			AssertThatXmlIn.Dom(dom.RawDom).HasSpecifiedNumberOfMatchesForXpath("html/head/base", 0);
			Assert.AreEqual(string.Empty, dom.BaseForRelativePaths);
		}
		[Test]
		public void BaseForRelativePaths_HasExistingBase_Removes()
		{
			var dom = new HtmlDom(
						  @"<html><head><base href='original'/></head></html>");
			AssertThatXmlIn.Dom(dom.RawDom).HasSpecifiedNumberOfMatchesForXpath("html/head/base[@href='original']", 1);
			dom.BaseForRelativePaths = "new";
			AssertThatXmlIn.Dom(dom.RawDom).HasSpecifiedNumberOfMatchesForXpath("html/head/base", 0);
			Assert.AreEqual("new", dom.BaseForRelativePaths);
		}


		[Test]
		public void RemoveMetaValue_IsThere_RemovesIt()
		{
			var dom = new HtmlDom(
						  @"<html><head>
				<meta name='one' content='1'/>
				</head></html>");
			dom.RemoveMetaElement("one");
			AssertThatXmlIn.Dom(dom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//meta[@name='one']", 0);
		}
		[Test]
		public void RemoveMetaValue_NotThere_OK()
		{
			var dom = new HtmlDom();
			dom.RemoveMetaElement("notthere");
		}

		[Test]
		public void AddClassIfMissing_AlreadyThere_LeavesAlone()
		{
			var dom = new XmlDocument();
			dom.LoadXml(@"<div class='one two three'/>");
			HtmlDom.AddClassIfMissing((XmlElement) dom.FirstChild, "two");
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("div[@class='one two three']",1);
		}
		[Test]
		public void AddClassIfMissing_Missing_Adds()
		{
			var dom = new XmlDocument();
			dom.LoadXml(@"<div class='one three'/>");
			HtmlDom.AddClassIfMissing((XmlElement)dom.FirstChild, "two");
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("div[@class='one three two']", 1);
		}
		[Test]
		public void AddClassIfMissing_NoClasses_Adds()
		{
			var dom = new XmlDocument();
			dom.LoadXml(@"<div class=''/>");
			HtmlDom.AddClassIfMissing((XmlElement)dom.FirstChild, "two");
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("div[@class='two']", 1);
		}

		[Test]
		[TestCase(null, "0.0")]
		[TestCase("Foobar 6 !", "0.0")]
		[TestCase("Bloom Version 3.8 (apparent build date: 28-Mar-2017)", "3.8")]
		[TestCase("Bloom Version 3.8.0 (apparent build date: 28-Mar-2017)", "3.8.0")]
		public void GetGeneratorVersion_Works(string value, string expected)
		{
			var dom = new HtmlDom($@"<html><head><meta name='Generator' content='{value}'></meta></head></html>");
			Assert.AreEqual(new System.Version(expected), dom.GetGeneratorVersion());
		}

		[Test]
		public void SortStyleSheetLinks_LeavesBasePageBeforePreviewMode()
		{
			var dom = new HtmlDom(
			   @"<html><head>
				<link rel='stylesheet' href='../../previewMode.css' type='text/css' />
				<link rel='stylesheet' href='basePage.css' type='text/css' />
				</head></html>");

			dom.SortStyleSheetLinks();

			AssertThatXmlIn.Dom(dom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//head/link[1][@href='basePage.css']", 1);
			AssertThatXmlIn.Dom(dom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//head/link[2][@href='../../previewMode.css']", 1);
		}

		[Test]
		public void SortStyleSheetLinks_LeavesOverridesAtEndAndSpecialFilesInMiddle()
		{
			var content =
			   @"<html><head>
				<link rel='stylesheet' href='my special b.css' type='text/css' />
				<link rel='stylesheet' href='Factory-Xmatter.css' type='text/css' />
				<link rel='stylesheet' href='my special a.css' type='text/css' />
				<link rel='stylesheet' href='../settingsCollectionStyles.css' type='text/css' />
				<link rel='stylesheet' href='my special c.css' type='text/css' />
				<link rel='stylesheet' href='Basic book.css' type='text/css' />
				<link rel='stylesheet' href='../customCollectionStyles.css' type='text/css' />
				<link rel='stylesheet' href='customBookStyles.css' type='text/css' />
				<link rel='stylesheet' href='basePage.css' type='text/css' />
				<link rel='stylesheet' href='languageDisplay.css' type='text/css' />
				<link rel='stylesheet' href='../../editMode.css' type='text/css' />

				</head></html>";

			var bookdom = new HtmlDom(content);

			bookdom.SortStyleSheetLinks();
			var dom = bookdom.RawDom;

			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[1][@href='basePage.css']", 1);
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[2][@href='../../editMode.css']", 1);
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[3][@href='Basic book.css']", 1);
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[4][@href='Factory-Xmatter.css']", 1);
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[5][@href='my special a.css']", 1);
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[6][@href='my special b.css']", 1);
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[7][@href='my special c.css']", 1);

			//NB: I (JH) don't for sure know yet what the order of this should be. I think it should be last-ish.
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[8][@href='languageDisplay.css']", 1);

			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[9][@href='../settingsCollectionStyles.css']", 1);
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[10][@href='../customCollectionStyles.css']", 1);
			AssertThatXmlIn.Dom(dom).HasSpecifiedNumberOfMatchesForXpath("//head/link[11][@href='customBookStyles.css']", 1);

		}


		[Test]
		public void MergeClassesIntoNewPage_BothEmtpy()
		{
			AssertHasClasses("", MergeClasses("","", new[] { "dropMe" }));
		}
		[Test]
		public void MergeClassesIntoNewPage_TargetEmpty()
		{
			AssertHasClasses("one two", MergeClasses("one two", "", new[] {"dropMe"}));
		}
		[Test]
		public void MergeClassesIntoNewPage_SourceEmpty()
		{
			AssertHasClasses("one two", MergeClasses("", "one two", new[] { "dropMe" }));
		}
		[Test]
		public void MergeClassesIntoNewPage_SourceAllDroppable()
		{
			AssertHasClasses("one two", MergeClasses("dropMe dropMe dropMe ", "one two", new[] { "dropMe" }));
		}
		[Test]
		public void MergeClassesIntoNewPage_MergesAndDropsItemsInDropList()
		{
			AssertHasClasses("one two three", MergeClasses("one drop two delete", "three", new[] { "drop","delete" }));
		}
		[Test]
		public void GetImageElementUrl_ElementIsImg_ReturnsSrc()
		{
			var element = MakeElement("<img src='test%20me'/>");
			Assert.AreEqual("test%20me", HtmlDom.GetImageElementUrl(element).UrlEncoded);
		}
		[Test]
		[Ignore("Does not currently work...not sure how to make it right.")]
		public void GetImageElementUrl_ElementIsImgWithPercent2B_ReturnsSrc()
		{
			var element = MakeElement("<img src='test%2bme'/>");
			Assert.AreEqual("test%2bme", HtmlDom.GetImageElementUrl(element).UrlEncoded);
		}
		[Test]
		[Ignore("Does not currently work...not sure how to make it right.")]
		public void GetImageElementUrl_ElementIsImgWithPlus_ReturnsSrc()
		{
			var element = MakeElement("<img src='test+me'/>");
			Assert.AreEqual("test+me", HtmlDom.GetImageElementUrl(element).UrlEncoded);
		}
		[Test]
		public void GetImageElementUrl_ElementIsDivWithBackgroundImage_ReturnsUrl()
		{
			var element = MakeElement("<div style='font-face:url(\"somefont\"); background-image:url(\"test%20me\")'/>");
            Assert.AreEqual("test%20me", HtmlDom.GetImageElementUrl(element).UrlEncoded);

			//stress the regex a bit
			element = MakeElement("<div style=\" background-image : URL(\'test%20me\')\"/>");
			Assert.AreEqual("test%20me", HtmlDom.GetImageElementUrl(element).UrlEncoded, "Query was too restrictive somehow");
		}

		[Test]
		public void GetImageElementUrl_ElementHasUrlOnFont_ReturnsEmpty()
		{
			var element = MakeElement("<div style='font-face:url(\"somefont\")'/>");
			Assert.AreEqual("", HtmlDom.GetImageElementUrl(element).UrlEncoded);
		}

		[Test]
		public void GetImageElementUrl_ElementHasNoImage_ReturnsEmpty()
		{
			var element = MakeElement("<div style='width:50px'/>");
			Assert.AreEqual("", HtmlDom.GetImageElementUrl(element).UrlEncoded);
		}

		private ElementProxy MakeElement(string xml)
		{
			var dom = new XmlDocument();
			dom.LoadXml(xml);
			return new ElementProxy(dom.DocumentElement);
		}

		private void AssertHasClasses(string expectedString, string actualString)
		{
			var expected = expectedString.Split(new[] { ' ' });
			var actual = actualString.Split(new[] {' '});
			Assert.AreEqual(expected.Length, actual.Length);
			foreach (var e in expected)
			{
				Assert.IsTrue(actual.Contains(e));
			}
		}

		private string MergeClasses(string sourceClasses, string targetClasses, string[] classesToDrop)
		{
			var sourceDom = new XmlDocument();
			sourceDom.LoadXml(string.Format("<div class='{0}'/>", sourceClasses));
			var targetDom = new XmlDocument();
			targetDom.LoadXml(string.Format("<div class='{0}'/>", targetClasses));
			var targetNode = (XmlElement)targetDom.SelectSingleNode("div");
			HtmlDom.MergeClassesIntoNewPage((XmlElement)sourceDom.SelectSingleNode("div"), targetNode, classesToDrop);
			return targetNode.GetStringAttribute("class");
		}

		[Test]
		public void RemoveExtraBookTitles_BookTitlesThatAreJustGeneric_Removed()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
				<div id='bloomDataDiv'>
						<div data-book='bookTitle' lang='en'>something unique</div>
						<div data-book='bookTitle' lang='id'>Buku Dasar</div>
						<div data-book='bookTitle' lang='tpi'>Nupela Buk</div>
				</div>
				<div id='somePage'>
					<div class='bloom-translationGroup bookTitle'>
						<div class='bloom-editable' data-book='bookTitle' lang='tpi'>
							<p>Nupela Buk<br/></p>
						</div>
						<div class='bloom-editable' data-book='bookTitle' lang='id'>
							<p>Buku Dasar</p>
						</div>
						<div class='bloom-editable' data-book='bookTitle'>
							<p>something unique<br/></p>
						</div>
					</div>
				</div>
			 </body></html>");
			bookDom.RemoveExtraBookTitles();
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='bookTitle' and @lang='en' and text()='something unique']", 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='bookTitle' and @lang='id']", 0);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='bookTitle' and @lang='tpi']", 0);
		}

		[Test]
		public void SetImageElementUrl_GivenImg_SetsSrc()
		{
			var img = MakeElement("<img src='old.png'/>");
			HtmlDom.SetImageElementUrl(img, UrlPathString.CreateFromUrlEncodedString("test%20me"));
			Assert.AreEqual("test%20me",img.GetAttribute("src"));
			Assert.AreEqual("", img.GetAttribute("style"));
		}
		[Test]
		public void SetImageElementUrl_GivenDiv_SetsStyle()
		{
			var div = MakeElement("<div style=\" background-image : URL(\'old.png\')\"/>");
			HtmlDom.SetImageElementUrl(div, UrlPathString.CreateFromUrlEncodedString("test%20me"));
			Assert.AreEqual("background-image:url(\'test%20me\')", div.GetAttribute("style"));
			Assert.AreEqual("", div.GetAttribute("src"));
		}

		[Test]
		public void SelectChildImgAndBackgroundImageElements()
		{
			var dom = new XmlDocument();
			dom.LoadXml("<div>" +
							"<div id='thisShouldBeIgnored'>" +
								"<img/>" +
								"<div style=\"background-image : URL(\'old.png\')\"/>" +
								"<img/>" +
								"<div style=\"background-image : URL(\'old.png\')\"/>" +
							"</div>" +
							"<div id='thisOne'>" +
								"<foo/>" +
								"<img/>" +
								"<div style=\"color:red;\">hello</div><div style=\" background-image : URL(\'old.png\')\"/>" +
							"</div>" +
						"</div>");
			var elements = HtmlDom.SelectChildImgAndBackgroundImageElements(dom.SelectSingleNode("//*[@id='thisOne']") as XmlElement);
			Assert.AreEqual(2,elements.Count);
		}

		[Test]
		public void GetIsImgOrSomethingWithBackgroundImage_NoBackgroundImageProperty_False()
		{
			var dom = new XmlDocument();
			dom.LoadXml("<div style=\"color:red;\"></div>");
			Assert.IsFalse(HtmlDom.IsImgOrSomethingWithBackgroundImage(dom.DocumentElement));
		}
		[Test]
		public void GetIsImgOrSomethingWithBackgroundImage_HasBackgroundImageProperty_True()
		{
			var dom = new XmlDocument();
			dom.LoadXml("<div style=\" background-image : URL(\'old.png\')\"></div>");
			Assert.IsTrue(HtmlDom.IsImgOrSomethingWithBackgroundImage(dom.DocumentElement));

			dom.LoadXml("<div style=\'background-image:url( \"old.png\" )\'></div>");
			Assert.IsTrue(HtmlDom.IsImgOrSomethingWithBackgroundImage(dom.DocumentElement), "Regex needs work?");
		}

		[Test]
		public void GetIsImgOrSomethingWithBackgroundImage_Img_True()
		{
			var dom = new XmlDocument();
			dom.LoadXml("<html><body><img/></body></html>");
			Assert.IsTrue(HtmlDom.IsImgOrSomethingWithBackgroundImage(dom.SelectNodes("//img")[0] as XmlElement));
		}
		[Test]
		public void GetIsImgOrSomethingWithBackgroundImage_ImgIsSybling_False()
		{
			var dom = new XmlDocument();
			dom.LoadXml("<html><body><img/><foo/></body></html>");
			Assert.IsFalse(HtmlDom.IsImgOrSomethingWithBackgroundImage(dom.SelectNodes("//foo")[0] as XmlElement));
		}
		[Test]
		public void GetIsImgOrSomethingWithBackgroundImage_ImgIsChild_False()
		{
			var dom = new XmlDocument();
			dom.LoadXml("<html><body><div><img/></div></body></html>");
			Assert.IsFalse(HtmlDom.IsImgOrSomethingWithBackgroundImage(dom.SelectNodes("//div")[0] as XmlElement));
		}
		[Test]
		public void RemoveBookSetting_TwoVariationsWereThere_BothRemoved()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
				<div id='bloomDataDiv'>
						<div data-book='leaveMe' lang='en'>something unique</div>
						<div data-book='removeMe' lang='id'>Buku Dasar</div>
						<div data-book='removeMe' lang='tpi'>Nupela Buk</div>
				</div>
			 </body></html>");
			bookDom.RemoveBookSetting("removeMe");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='removeMe']", 0);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='leaveMe']", 1);
		}
		[Test]
		public void RemoveBookSetting_NoneThere_NothingHappens()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
				<div id='bloomDataDiv'>
						<div data-book='leaveMe' lang='en'>something unique</div>
				</div>
			 </body></html>");
			bookDom.RemoveBookSetting("foobar");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='leaveMe']", 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book]", 1);
		}
		[Test]
		public void GetBookSetting_TwoVariationsWereThere_ReturnsBoth()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
				<div id='bloomDataDiv'>
						<div data-book='leaveMe' lang='en'>something unique</div>
						<div data-book='getMe' lang='id'>Buku</div>
						<div data-book='getMe' lang='tpi'>Buk</div>
				</div>
			 </body></html>");
			var result = bookDom.GetBookSetting("getMe");
			Assert.AreEqual(2,result.Count);
			Assert.AreEqual("Buk", result["tpi"]);
			Assert.AreEqual("Buku", result["id"]);
		}
		[Test]
		public void GetBookSetting_NotThere_ReturnsEmptyMultistring()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
				<div id='bloomDataDiv'>
				</div>
			 </body></html>");
			var result = bookDom.GetBookSetting("getMe");
			Assert.AreEqual(0, result.Count);
		}

		[Test]
		public void SetBookSetting_WasMissingCompletely_DataDivHasNewString()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
				<div id='bloomDataDiv'>
				</div>
			 </body></html>");
			bookDom.SetBookSetting("foo","xyz","hello");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo' and @lang='xyz' and text()='hello']", 1);
		}
		[Test]
		public void SetBookSetting_NoDataDivYet_SettingAdded()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
			 </body></html>");
			bookDom.SetBookSetting("foo", "xyz", "hello");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//body/div[@id='bloomDataDiv']/div[@data-book='foo' and @lang='xyz' and text()='hello']", 1);
		}
		[Test]
		public void SetBookSetting_HadADifferentValueCompletely_NewValue()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
				<div id='bloomDataDiv'>
					<div data-book='foo' lang='en'>blah</div>
					<div data-book='foo' lang='xyz'>boo</div>
				</div>
			 </body></html>");
			bookDom.SetBookSetting("foo", "xyz", "hello");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo' and @lang='xyz' and text()='hello']", 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo' and @lang='en' and text()='blah']", 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo']", 2);
		}

		[Test]
		public void SetBookSetting_HadValueWithNoLanguage_RemovesItAndSavesNewValue()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
				<div id='bloomDataDiv'>
					<div data-book='foo'>blah</div>
					<div data-book='foo' lang='en'>blah</div>
				</div>
			 </body></html>");
			bookDom.SetBookSetting("foo", "xyz", "hello");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo' and @lang='xyz' and text()='hello']", 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo' and @lang='en' and text()='blah']", 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasNoMatchForXpath("//div[@data-book='foo' and not(@lang)]");
		}

		[Test]
		public void SetBookSetting_AddANewVariationToAnExistingKey_Added()
		{
			var bookDom = new HtmlDom(@"<html ><head></head><body>
				<div id='bloomDataDiv'>
					<div data-book='foo' lang='en'>English</div>
					<div data-book='foo' lang='id'>Indonesian</div>
				</div>
			 </body></html>");
			bookDom.SetBookSetting("foo", "fr", "French");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo' and @lang='id' and text()='Indonesian']", 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo' and @lang='en' and text()='English']", 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo' and @lang='fr' and text()='French']", 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath("//div[@data-book='foo']", 3);
		}

		[Test]
		public void SetElementFromUserStringPreservingLineBreaks_Various()
		{
			var dom = new XmlDocument();
			dom.LoadXml("<div></div>");
			var target = dom.FirstChild as XmlElement;
			HtmlDom.SetElementFromUserStringPreservingLineBreaks(target, "1<br />2");
			Assert.AreEqual("<div>1<br />2</div>", dom.InnerXml);
			HtmlDom.SetElementFromUserStringPreservingLineBreaks(target, "1<br/>2");
			Assert.AreEqual("<div>1<br />2</div>",dom.InnerXml);

			HtmlDom.SetElementFromUserStringPreservingLineBreaks(target, "1<br/>2<br />3");
			Assert.AreEqual("<div>1<br />2<br />3</div>", dom.InnerXml);

			HtmlDom.SetElementFromUserStringPreservingLineBreaks(target, "1 2 3");
			Assert.AreEqual("<div>1 2 3</div>", dom.InnerXml);

			HtmlDom.SetElementFromUserStringPreservingLineBreaks(target, "1 < 3 > 0");
			Assert.AreEqual("<div>1 &lt; 3 &gt; 0</div>", dom.InnerXml);
		}

		[Test]
		public void ConvertHtmlBreaksToNewLines_Works()
		{
			var NL = System.Environment.NewLine;
			Assert.AreEqual("1"+NL+"2",HtmlDom.ConvertHtmlBreaksToNewLines("1<br />2"));
			Assert.AreEqual("1" + NL + "2", HtmlDom.ConvertHtmlBreaksToNewLines("1<br>2"));
			Assert.AreEqual("1" + NL + "2", HtmlDom.ConvertHtmlBreaksToNewLines("1<br/>2"));
		}

		private const string StylesContainsXpath = "//style[@title=\"userModifiedStyles\" and contains(text(),'{0}')]";

		private void VerifyUserStylesCdataWrapping(XmlNode dom)
		{
			var stylesNodes = dom.SelectNodes("/html/head/style[@title=\"userModifiedStyles\"]");
			Assert.AreEqual(1, stylesNodes.Count, "Should only be one userModifiedStyles element.");
			var contents = stylesNodes[0].InnerText.Trim();
			Assert.That(contents.LastIndexOf(Browser.CdataPrefix).Equals(0),
				"userModifiedStyles begins with a unique copy of the CDATA prefix.");
			Assert.That(contents.IndexOf(Browser.CdataSuffix).Equals(contents.Length - Browser.CdataSuffix.Length),
				"userModifiedStyles ends with a unique copy of the CDATA suffix");
		}

		[Test]
		public void MergeUserModifiedStyles_EmptyExisting_Works()
		{
			var bookDom = new HtmlDom(
				@"<html>
					<head></head>
					<body></body>
				</html>");
			var pageDom = new XmlDocument();
			pageDom.LoadXml(
				@"<html>
					<head>
						<style type='text/css' title='userModifiedStyles'>
							.MyTest-style { font-size: ginormous; }
						</style>
					</head>
					<body></body>
				</html>");

			var pageStyleNode = pageDom.SelectSingleNode("//style");
			var bookStyleNode = HtmlDom.AddEmptyUserModifiedStylesNode(bookDom.Head);
			// SUT
			bookStyleNode.InnerText = HtmlDom.MergeUserStylesOnInsertion(bookStyleNode, pageStyleNode);

			var xpath = string.Format(StylesContainsXpath, ".MyTest-style { font-size: ginormous; }");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(xpath, 1);
			VerifyUserStylesCdataWrapping(bookDom.RawDom);
		}

		[Test]
		public void MergeUserModifiedStyles_EmptyMergingPage_Works()
		{
			var bookDom = new HtmlDom(
				@"<html>
					<head>
						<style type='text/css' title='userModifiedStyles'>
							.MyTest-style { font-size: ginormous; }
						</style>
					</head>
					<body></body>
				</html>");
			var pageDom = new XmlDocument();
			pageDom.LoadXml(
				@"<html>
					<head></head>
					<body></body>
				</html>");

			var pageStyleNode = pageDom.SelectSingleNode("//style");
			var bookStyleNode = HtmlDom.GetUserModifiedStyleElement(bookDom.Head);
			// SUT
			bookStyleNode.InnerText = HtmlDom.MergeUserStylesOnInsertion(bookStyleNode, pageStyleNode);

			var xpath = string.Format(StylesContainsXpath, ".MyTest-style { font-size: ginormous; }");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(xpath, 1);
			VerifyUserStylesCdataWrapping(bookDom.RawDom);
		}

		[Test]
		public void MergeUserModifiedStyles_ExistingStyle_NotOverwritten()
		{
			var bookDom = new HtmlDom(
				@"<html>
					<head>
						<style type='text/css' title='userModifiedStyles'>
							.MyTest-style { font-size: ginormous; }</style>
					</head>
					<body>
						<div class='MyTest-style bogus'></div>
					</body>
				</html>");
			var pageDom = new XmlDocument();
			pageDom.LoadXml(@"<html>
				<head>
					<style type='text/css' title='userModifiedStyles'>
						.MyTest-style { font-size: smaller; }</style>
				</head>
				<body>
					<div class='MyTest-style bogus'></div>
				</body>
			</html>");

			var pageStyleNode = pageDom.SelectSingleNode("//style");
			var bookStyleNode = HtmlDom.GetUserModifiedStyleElement(bookDom.Head);
			// SUT
			bookStyleNode.InnerText = HtmlDom.MergeUserStylesOnInsertion(bookStyleNode, pageStyleNode);

			var xpath = string.Format(StylesContainsXpath, "font-size: ginormous;");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(xpath, 1);
			var xpath2 = "//style[@title=\"userModifiedStyles\" and contains(text(),'font-size: smaller;')]";
			AssertThatXmlIn.Dom(bookDom.RawDom).HasNoMatchForXpath(xpath2);
			VerifyUserStylesCdataWrapping(bookDom.RawDom);
		}

		[Test]
		public void MergeUserModifiedStyles_NewStyleHasLangAttr_Ignored()
		{
			var bookDom = new HtmlDom(
				@"<html>
					<head>
						<style type='text/css' title='userModifiedStyles'>
							.MyTest-style { font-size: ginormous; }</style>
					</head>
					<body>
						<div class='MyTest-style bogus'></div>
					</body>
				</html>");
			var pageDom = new XmlDocument();
			pageDom.LoadXml(@"<html>
				<head>
					<style type='text/css' title='userModifiedStyles'>
						.MyTest-style[lang='en'] { font-size: smaller; }
					</style>
				</head>
				<body>
					<div class='MyTest-style bogus'></div>
				</body>
			</html>");

			var pageStyleNode = pageDom.SelectSingleNode("//style");
			var bookStyleNode = HtmlDom.GetUserModifiedStyleElement(bookDom.Head);
			// SUT
			bookStyleNode.InnerText = HtmlDom.MergeUserStylesOnInsertion(bookStyleNode, pageStyleNode);

			var xpath = string.Format(StylesContainsXpath, "font-size: ginormous;");
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(xpath, 1);
			var xpath2 = "//style[@title=\"userModifiedStyles\" and contains(text(),\".MyTest-style[lang='en'] { font-size: smaller;\")]";
			AssertThatXmlIn.Dom(bookDom.RawDom).HasNoMatchForXpath(xpath2);
			VerifyUserStylesCdataWrapping(bookDom.RawDom);
		}

		[Test]
		public void MergeUserModifiedStyles_NewStyleHasMultipleLines()
		{
			var bookDom = new HtmlDom(
				@"<html>
					<head>
						<style type='text/css' title='userModifiedStyles'>
							.SomeOther-style { font-size: ginormous; }</style>
					</head>
					<body>
						<div class='MyTest-style bogus'></div>
					</body>
				</html>");
			var pageDom = new XmlDocument();
			pageDom.LoadXml(@"<html>
				<head>
					<style type='text/css' title='userModifiedStyles'>
.MyTest-style[lang='en']
{
	font-size: smaller;
}
					</style>
				</head>
				<body>
					<div class='MyTest-style bogus'></div>
				</body>
			</html>");

			var pageStyleNode = pageDom.SelectSingleNode("//style");
			var bookStyleNode = HtmlDom.GetUserModifiedStyleElement(bookDom.Head);
			// SUT
			bookStyleNode.InnerText = HtmlDom.MergeUserStylesOnInsertion(bookStyleNode, pageStyleNode);

			var commonXpathPart = "//style[@title=\"userModifiedStyles\" and contains(text()";
			var xpath = commonXpathPart + ",'font-size: ginormous;')]";
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(xpath, 1);
			var xpath2 = commonXpathPart + ",\".MyTest-style[lang='en']" + Environment.NewLine +
				"{" + Environment.NewLine + "font-size: smaller;" + Environment.NewLine + "}" + Environment.NewLine + "\")]";
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(xpath2, 1);
			VerifyUserStylesCdataWrapping(bookDom.RawDom);
		}

		[Test]
		public void FixAnyAddedCustomPages_Works()
		{
			var content =
				@"<html>
					<head></head>
					<body>
						<div id='bloomDataDiv'>
							<div data-book='styleNumberSequence' lang='*'>0</div>
						</div>
						<div class='bloom-page numberedPage customPage A5Portrait bloom-monolingual' data-page='' id='2141ae70-d84f-4b40-bb30-18c20941e84e' data-pagelineage='5dcd48df-e9ab-4a07-afd4-6a24d0398386' lang=''>
							<div class='pageLabel' data-i18n='TemplateBooks.PageLabel.Custom' lang='en'>Custom</div>
							<div class='pageDescription' lang='en'>A blank page that allows you to add items.</div>
							<div class='marginBox'></div>
						</div>
						<div class='bloom-page numberedPage customPage A5Portrait bloom-monolingual' data-page='extra' id='ff5f83b6-d26e-439f-8df6-cf982a521de4' data-pagelineage='5dcd48df-e9ab-4a07-afd4-6a24d0398386' lang=''>
							<div class='pageLabel' lang='en'>Dual Picture Before Text</div>
							<div class='pageDescription' lang='en'></div>
							<div class='marginBox'></div>
						</div>
					</body>
				</html>";

			var bookDom = new HtmlDom(content);

			var allTopLevelDivs = "/html/body/div";
			var pageDivs = "/html/body/div[contains(@class,'bloom-page') and contains(@class,'customPage')]";
			var badPageDivs = "/html/body/div[contains(@class,'bloom-page') and contains(@class,'customPage') and @data-page='']";
			var goodPageDivs = "/html/body/div[contains(@class,'bloom-page') and contains(@class,'customPage') and @data-page='extra']";
			var badPageLabels = "/html/body/div[contains(@class,'bloom-page') and contains(@class,'customPage')]/div[@class='pageLabel' and @data-i18n]";
			var goodPageLabels = "/html/body/div[contains(@class,'bloom-page') and contains(@class,'customPage')]/div[@class='pageLabel' and not(@data-i18n)]";
			var pageDescription = "/html/body/div[contains(@class,'bloom-page') and contains(@class,'customPage')]/div[@class='pageDescription']";

			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(allTopLevelDivs, 3);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(pageDivs, 2);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(badPageDivs, 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(goodPageDivs, 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(badPageLabels, 1);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(goodPageLabels, 1);
			var countEmpty = 0;
			foreach (XmlElement node in bookDom.RawDom.SafeSelectNodes(pageDescription))
			{
				if (String.IsNullOrWhiteSpace(node.InnerXml))
					++countEmpty;
			}
			Assert.That(countEmpty, Is.EqualTo(1));

			bookDom.FixAnyAddedCustomPages();

			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(allTopLevelDivs, 3);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(pageDivs, 2);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasNoMatchForXpath(badPageDivs);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(goodPageDivs, 2);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasNoMatchForXpath(badPageLabels);
			AssertThatXmlIn.Dom(bookDom.RawDom).HasSpecifiedNumberOfMatchesForXpath(goodPageLabels, 2);
			countEmpty = 0;
			foreach (XmlElement node in bookDom.RawDom.SafeSelectNodes(pageDescription))
			{
				if (String.IsNullOrWhiteSpace(node.InnerXml))
					++countEmpty;
			}
			Assert.That(countEmpty, Is.EqualTo(2));
		}
	}
}
