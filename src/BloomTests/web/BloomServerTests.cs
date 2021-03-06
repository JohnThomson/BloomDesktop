﻿using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
using Bloom;
using Bloom.Book;
using Bloom.Collection;
using Bloom.Edit;
using Bloom.ImageProcessing;
using Bloom.Api;
using Moq;
using NUnit.Framework;
using SIL.IO;
using SIL.TestUtilities;

namespace BloomTests.web
{
	[TestFixture]
	public class BloomServerTests
	{
		private TemporaryFolder _folder;
		private FileLocator _fileLocator;
		private Mock<BookCollection> _vernacularLibraryCollection;
		private List<BookInfo> _bookInfoList;
		private Mock<SourceCollectionsList> _storeCollectionList;
		private Mock<CollectionSettings> _librarySettings;

		[SetUp]
		public void Setup()
		{
			_folder = new TemporaryFolder("BookCollectionTests");
			//			_fileLocator = new BloomFileLocator(new CollectionSettings(), new XMatterPackFinder(new string[]{}), new string[] { FileLocator.GetDirectoryDistributedWithApplication("root"), FileLocator.GetDirectoryDistributedWithApplication("factoryCollections") });
			_fileLocator = new FileLocator(new string[] { FileLocator.GetDirectoryDistributedWithApplication(BloomFileLocator.BrowserRoot),
				//FileLocator.GetDirectoryDistributedWithApplication("browserui/bookCSS"),
				FileLocator.GetDirectoryDistributedWithApplication("factoryCollections") });

//			_vernacularLibraryCollection = new BookCollection(_folder.Path, BookCollection.CollectionType.TheOneEditableCollection, BookFactory,
//				BookStorageFactory, null, null, new CreateFromSourceBookCommand(), new EditBookCommand());

			_vernacularLibraryCollection = new Mock<BookCollection>();
			_bookInfoList = new List<BookInfo>();
			_vernacularLibraryCollection.Setup(x => x.GetBookInfos()).Returns(_bookInfoList);
			_storeCollectionList = new Mock<SourceCollectionsList>();
			_storeCollectionList.Setup(x => x.GetSourceCollections()).Returns(() => GetStoreCollections());
			_librarySettings = new Mock<CollectionSettings>();
			_librarySettings.Setup(x => x.CollectionName).Returns(() => "Foo");

		}

		public virtual IEnumerable<BookCollection> GetStoreCollections()
		{
			Mock<BookCollection> c = new Mock<BookCollection>();
			c.Setup(x => x.Name).Returns("alpha");
			c.Setup(x => x.GetBookInfos()).Returns(_bookInfoList);
			yield return c.Object;
			Mock<BookCollection> b = new Mock<BookCollection>();
			b.Setup(x => x.Name).Returns("beta");
			b.Setup(x => x.GetBookInfos()).Returns(_bookInfoList);
			yield return b.Object;
		}

		Bloom.Book.Book BookFactory(BookStorage storage, bool editable)
		{
			return new Bloom.Book.Book(new BookInfo(storage.FolderPath, true),  storage, null, new CollectionSettings(new NewCollectionSettings() { PathToSettingsFile = CollectionSettings.GetPathForNewSettings(_folder.Path, "test"), Language1Iso639Code = "xyz" }),
													 new PageSelection(),
													 new PageListChangedEvent(), new BookRefreshEvent());
		}

		BookStorage BookStorageFactory(string folderPath)
		{
			return new BookStorage(folderPath, _fileLocator, new BookRenamedEvent(), new CollectionSettings());
		}

		[Test, Ignore]	// The entire fixture had been ignored for some time.
		public void GetLibaryPage_ReturnsLibraryPage()
		{
			var b = CreateBloomServer();
			var transaction = new PretendRequestInfo(ServerBase.ServerUrlWithBloomPrefixEndingInSlash + "library/library.htm");
			b.MakeReply(transaction);
			Assert.IsTrue(transaction.ReplyContents.Contains("library.css"));
		}

		private BloomServer CreateBloomServer()
		{
			return new BloomServer(_librarySettings.Object, _vernacularLibraryCollection.Object, _storeCollectionList.Object,null);
		}

		[Test, Ignore]  // The entire fixture had been ignored for some time.
		public void GetVernacularBookList_ThereAreNone_ReturnsNoListItems()
		{
			var b = CreateBloomServer();
			var transaction = new PretendRequestInfo(ServerBase.ServerUrlWithBloomPrefixEndingInSlash + "libraryContents");
			_bookInfoList.Clear();
			b.MakeReply(transaction);
			AssertThatXmlIn.String(transaction.ReplyContentsAsXml).HasNoMatchForXpath("//li");
		}
		[Test, Ignore]  // The entire fixture had been ignored for some time.
		public void GetVernacularBookList_ThereAre2_Returns2ListItems()
		{
			var b = CreateBloomServer();
			var transaction = new PretendRequestInfo(ServerBase.ServerUrlWithBloomPrefixEndingInSlash + "libraryContents");
			AddBook("1","one");
			AddBook("2", "two");
			b.MakeReply(transaction);
			AssertThatXmlIn.String(transaction.ReplyContentsAsXml).HasSpecifiedNumberOfMatchesForXpath("//li", 2);
		}

		/* can't tell if this storeCollectionList ever existed		[Test]
				public void GetStoreBooks_ThereAre2_Returns2CollectionItems()
				{
					var b = CreateBloomServer();
					var transaction = new PretendRequestInfo(ServerBase.PathEndingInSlash+"storeCollectionList");
					b.MakeReply(transaction);
					AssertThatXmlIn.String(transaction.ReplyContentsAsXml).HasSpecifiedNumberOfMatchesForXpath("//li//h2[text()='alpha']", 1);
					AssertThatXmlIn.String(transaction.ReplyContentsAsXml).HasSpecifiedNumberOfMatchesForXpath("//li//h2[text()='beta']", 1);
					AssertThatXmlIn.String(transaction.ReplyContentsAsXml).HasSpecifiedNumberOfMatchesForXpath("//li/ul", 2);
				}
		 */
		private void AddBook(string id, string title)
		{
			var b = new Mock<BookInfo>();
			b.SetupGet(x => x.Id).Returns(id);
			b.SetupGet(x => x.QuickTitleUserDisplay).Returns(title);
			b.SetupGet(x => x.FolderPath).Returns(Path.GetTempPath);//TODO. this works at the moment, cause we just need some folder which exists
			_bookInfoList.Add(b.Object);
		}

		[Test]
		public void GetLocalPathWithoutQuery_HandlesNetworkDriveCorrectly()
		{
			var path = @"//someserver/somefolder/somebook.htm";
			var url = path.ToLocalhost() + "?thumbnail=1";
			var request = new PretendRequestInfo(url);
			var result = ServerBase.GetLocalPathWithoutQuery(request);
			Assert.That(result, Is.EqualTo(path));
		}

		[Test]
		public void CorrectedLocalPath_HandlesNetworkDriveCorrectly()
		{
			var path = "//myserver/myfolder/myfile.htm";
			var url = path.ToLocalhost();
			var request = new PretendRequestInfo(url);
			var result = ServerBase.CorrectedLocalPath(request);
			Assert.That(result, Is.EqualTo(ServerBase.BloomUrlPrefix + path));

			// This tests the condition leading to BL-2932.
			request = new PretendRequestInfo(url, forPrinting: true);
			result = ServerBase.CorrectedLocalPath(request);
			Assert.That(result, Is.EqualTo(ServerBase.BloomUrlPrefix + "OriginalImages/" + path));
		}

		[Test]
		public void GetLocalPathWithoutQuery_HandlesLocalDriveCorrectly()
		{
			var path = @"C:/Users/myname/Documents/Bloom/Collection/Some Book/Some Book.htm";
			var url = path.ToLocalhost() + "?thumbnail=1";
			var request = new PretendRequestInfo(url);
			var result = ServerBase.GetLocalPathWithoutQuery(request);
			Assert.That(result, Is.EqualTo(path));

			path = @"/home/myname/Bloom/Collection/Some Book/Some Book.htm";
			url = path.ToLocalhost() + "?thumbnail=1";
			request = new PretendRequestInfo(url);
			result = ServerBase.GetLocalPathWithoutQuery(request);
			Assert.That(result, Is.EqualTo(path));
		}

		[Test]
		public void CorrectedLocalPath_HandlesLocalDriveCorrectly()
		{
			var path = "C:/Users/myname/Documents/Bloom/My Collection/My Book/My Book.htm";
			var url = path.ToLocalhost();
			var request = new PretendRequestInfo(url);
			var result = ServerBase.CorrectedLocalPath(request);
			Assert.That(result, Is.EqualTo(ServerBase.BloomUrlPrefix + path));

			request = new PretendRequestInfo(url, forPrinting: true);
			result = ServerBase.CorrectedLocalPath(request);
			Assert.That(result, Is.EqualTo(ServerBase.BloomUrlPrefix + "OriginalImages/" + path));

			path = "/home/myname/Bloom/My Collection/My Book/My Book.htm";
			url = path.ToLocalhost();
			request = new PretendRequestInfo(url);
			result = ServerBase.CorrectedLocalPath(request);
			Assert.That(result, Is.EqualTo(ServerBase.BloomUrlPrefix + path));

			request = new PretendRequestInfo(url, forPrinting: true);
			result = ServerBase.CorrectedLocalPath(request);
			Assert.That(result, Is.EqualTo(ServerBase.BloomUrlPrefix + "OriginalImages/" + path));
		}
		//In normal runtime, we can't actually have two servers... a static is used to ease access to the URL
		//But we can get away with it long enough to test the case where some previous run of Bloom has not
		//released its port (BL-3313).
		[Test]
		public void RunTwoServer_UseDifferentPorts()
		{
			using(var x = new ImageServer(null))
			{
				x.StartListening();
				var firstUrl = ServerBase.ServerUrl;
				using(var y = new ImageServer(null))
				{
					y.StartListening();
					var secondUrl = ServerBase.ServerUrl;
					Assert.AreNotEqual(firstUrl, secondUrl);
					Console.WriteLine(firstUrl+", "+secondUrl);
				}
			}
		}
	}
}
