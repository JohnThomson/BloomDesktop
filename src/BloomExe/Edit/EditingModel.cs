﻿using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Xml;
using Palaso.UI.WindowsForms.ImageToolbox;
using Skybound.Gecko;

namespace Bloom.Edit
{
	public class EditingModel
	{
		private readonly BookSelection _bookSelection;
		private readonly PageSelection _pageSelection;
		private readonly LanguageSettings _languageSettings;
		private readonly ProjectSettings _projectSettings;
		private XmlDocument _domForCurrentPage;
		private bool _visible;
		private Book _currentlyDisplayedBook;
		private EditingView _view;


		public event EventHandler UpdatePageList;

		public delegate EditingModel Factory();//autofac uses this

		public EditingModel(BookSelection bookSelection, PageSelection pageSelection,
			LanguageSettings languageSettings,
			TemplateInsertionCommand templateInsertionCommand,
			PageListChangedEvent pageListChangedEvent,
			RelocatePageEvent relocatePageEvent,
			DeletePageCommand deletePageCommand,
			ProjectSettings projectSettings)
		{
			_bookSelection = bookSelection;
			_pageSelection = pageSelection;
			_languageSettings = languageSettings;
			_projectSettings = projectSettings;

			//bookSelection.SelectionChanged += new EventHandler(OnBookSelectionChanged);
			pageSelection.SelectionChanged += new EventHandler(OnPageSelectionChanged);
			templateInsertionCommand.InsertPage += new EventHandler(OnInsertTemplatePage);
			deletePageCommand.Implementer=OnDeletePage;
			pageListChangedEvent.Subscribe(x => InvokeUpdatePageList());
			relocatePageEvent.Subscribe(OnRelocatePage);
		}

		private void OnDeletePage()
		{
			_currentlyDisplayedBook.DeletePage(_pageSelection.CurrentSelection);
			_view.UpdatePageList();
		}

		private void OnRelocatePage(RelocatePageInfo info)
		{
			_bookSelection.CurrentSelection.RelocatePage(info.Page, info.IndexOfPageAfterMove);

		}


		private void OnInsertTemplatePage(object sender, EventArgs e)
		{
			_bookSelection.CurrentSelection.InsertPageAfter(DeterminePageWhichWouldPrecedeNextInsertion(), sender as Page);
			_view.UpdatePageList();
			//_pageSelection.SelectPage(newPage);
		}

		/// <summary>
		/// if we were add a template page right now, what would be its initial location?
		/// </summary>
		//        public int CurrentInsertPoint
		//        {
		//
		//        }

		public string CurrentBookName
		{
			get
			{
				if (_bookSelection.CurrentSelection == null)
					return "----";
				return _bookSelection.CurrentSelection.Title;
			}
		}

		public bool HaveCurrentEditableBook
		{
			get { return _bookSelection.CurrentSelection != null; }
		}

		public Book CurrentBook
		{
			get { return _bookSelection.CurrentSelection; }
		}

		public bool ShowTranslationPanel
		{
			get
			{
				return _bookSelection.CurrentSelection.HasSourceTranslations;
			}
		}

		public bool ShowTemplatePanel
		{
			get
			{
				if (_projectSettings.IsShellMakingProject)
				{
					return true;
				}
				else
				{
					return !ShowTranslationPanel;
				}
			}
		}

		public bool CanDeletePage
		{
			get
			{
				return _pageSelection != null && _pageSelection.CurrentSelection != null &&
					   !_pageSelection.CurrentSelection.Required;
			}

		}

		public bool GetBookHasChanged()
		{
			return _currentlyDisplayedBook != CurrentBook;
		}

		public void ActualVisibiltyChanged(bool visible)
		{
			_visible = visible;
			Debug.WriteLine("EditingModel._visible =" + _visible);
			if (!visible || _currentlyDisplayedBook == CurrentBook)
				return;

			_currentlyDisplayedBook = CurrentBook;
			//if (_bookSelection.CurrentSelection.Type == Book.BookType.Publication)
			{
				var page = _bookSelection.CurrentSelection.FirstPage;
				if (page != null)
					_pageSelection.SelectPage(page);
			}
			if (_view != null)
			{
				_view.UpdateTemplateList();
				_view.UpdatePageList();
			}
		}

		void OnPageSelectionChanged(object sender, EventArgs e)
		{
			if (_view != null)
			{
				_view.UpdateSingleDisplayedPage(_pageSelection.CurrentSelection);
				_view.SetSourceText(new Dictionary<string, string>());
			}
		}

		public XmlDocument GetXmlDocumentForCurrentPage()
		{
			_domForCurrentPage = _bookSelection.CurrentSelection.GetEditableHtmlDomForPage(_pageSelection.CurrentSelection);
			return _domForCurrentPage;
		}

		public void SaveNow()
		{
			_bookSelection.CurrentSelection.SavePage(_domForCurrentPage);
		}

		public void ChangePicture(string id, PalasoImage imageInfo)
		{
			var editor = new PageEditingModel();

			editor.ChangePicture(_bookSelection.CurrentSelection.FolderPath, _domForCurrentPage, id, imageInfo);

			//We have a problem where if we save at this point, any text changes are lost.
			//The hypothesis is that the "onblur" javascript has not run, so the value of the textareas have not yet changed.

			_view.ReadEditableAreasNow();

			SaveNow();//have to save now because we're going to reload the page to show the new picture

			//review: this is spagetti
			_bookSelection.CurrentSelection.UpdatePagePreview(_pageSelection.CurrentSelection);

			_view.UpdateSingleDisplayedPage(_pageSelection.CurrentSelection);
			InvokeUpdatePageList();
		}

		private void InvokeUpdatePageList()
		{
			if (UpdatePageList != null)
			{
				UpdatePageList(this, null);
			}
		}

		public void SetView(EditingView view)
		{
			_view = view;
		}

		public void HandleUserEnteredArea(GeckoElement element)
		{
			//the parent is the paragraph, which is the element which has the id. The textareas themselves just have @lang
			var sourceTexts = _pageSelection.CurrentSelection.GetSourceTexts(element.Id);
			if (sourceTexts.Count == 0)
			{
				_view.SetSourceText(null);
			}
			else
			{
				sourceTexts = RemoveVernacularFromSourceTexts(sourceTexts);
				_view.SetSourceText(sourceTexts);//_languageSettings.ChooseBestSource(sourceTexts, string.Empty));
			}
		}

		private Dictionary<string, string> RemoveVernacularFromSourceTexts(Dictionary<string, string> sourceTexts)
		{
			var x = sourceTexts.Where(t => t.Key != _languageSettings.VernacularIso639Code);
			sourceTexts = new Dictionary<string, string>();
			foreach (var keyValuePair in x)
			{
				sourceTexts.Add(keyValuePair.Key,keyValuePair.Value);
			}
			return sourceTexts;
		}

		public IPage DeterminePageWhichWouldPrecedeNextInsertion()
		{
			if (_view != null)
			{
				var pagesStartingWithCurrentSelection =
					_bookSelection.CurrentSelection.GetPages().SkipWhile(p => p.Id != _pageSelection.CurrentSelection.Id);
				var candidates = pagesStartingWithCurrentSelection.ToArray();
				for (int i = 0; i < candidates.Length - 1; i++)
				{
					if (!candidates[i + 1].Required)
					{
						return candidates[i];
					}
				}
				return _bookSelection.CurrentSelection.GetPages().LastOrDefault();
			}
			return null;
		}
	}

		//_book.DeletePage(_pageSelection.CurrentSelection);

	public class TemplateInsertionCommand
	{
		public event EventHandler InsertPage;

		public void Insert(Page page)
		{
			if (InsertPage != null)
			{
				InsertPage.Invoke(page, null);
			}
		}
	}
}
