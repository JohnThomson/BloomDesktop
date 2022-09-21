﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using Bloom;
using Bloom.Book;
using Bloom.Collection;
using Bloom.Spreadsheet;
using Bloom.web;

namespace BloomTests.Spreadsheet
{
	/// <summary>
	/// Modifies SpreadsheetImporter by overriding the methods that use a real WebView2Browser
	/// so that we don't actually have to get one. This prevents some weird problems on TeamCity.
	/// </summary>
	internal class TestSpreadsheetImporter : SpreadsheetImporter
	{
		public TestSpreadsheetImporter(IBloomWebSocketServer webSocketServer, HtmlDom destinationDom, string pathToSpreadsheetFolder = null, string pathToBookFolder = null, CollectionSettings collectionSettings = null) : base(webSocketServer, destinationDom, pathToSpreadsheetFolder, pathToBookFolder, collectionSettings)
		{
		}

		protected override Browser GetBrowser()
		{
			throw new ApplicationException("Must not use real browser in unit testing");
		}

		// A dreadfully crude approximation, but good enough for these tests.
		protected override string GetMd5(XmlElement elt)
		{
			return elt.InnerText.GetHashCode().ToString();
		}

		// This is also a crude approximation; it won't, for example, handle any sentence-ending punctuation
		// besides period. But it covers the text used in the relevant tests.
		protected override string[] GetSentenceFragments(string text)
		{
			return GetFrags(text).ToArray();
		}

		IEnumerable<string> GetFrags(string text)
		{
			var sentences = text.Replace("\\'", "'").Split('.');
			for (int i = 0; i < sentences.Length - 1; i++)
			{
				sentences[i] = sentences[i] + ".";
			}

			yield return "s" + sentences[0];

			foreach (var sentence in sentences.Skip(1))
			{
				var s1 = sentence.TrimStart();
				if (sentence.Length > s1.Length)
					yield return " " + sentence.Substring(sentence.Length - s1.Length);
				if (s1.Length > 0)
					yield return "s" + s1;
			}
		}
	}
}
