using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using Bloom;
using Bloom.Book;
using Bloom.CollectionCreating;
using SIL.IO;

namespace BloomToc
{
	public partial class BloomTocForm : Form
	{
		public BloomTocForm()
		{
			InitializeComponent();
		}

		private void startButton_Click(object sender, EventArgs e)
		{
			using (var dlg = new DialogAdapters.OpenFileDialogAdapter())
			{
				//dlg.FileName = Path.GetFileNameWithoutExtension(SelectedBook.GetPathHtmlFile()) + ".xml";
				
				dlg.InitialDirectory = NewCollectionWizard.DefaultParentDirectoryForCollections;
				dlg.Filter = "HTML|*.htm";
				if (DialogResult.OK == dlg.ShowDialog())
				{
					var bookPath = dlg.FileName;
					var xmlDomFromHtmlFile = XmlHtmlConverter.GetXmlDomFromHtmlFile(bookPath, false);
					var dom = new HtmlDom(xmlDomFromHtmlFile);
					TocMaker.UpdateToc(dom);
					// Enhance: consider reusing parts of BookStorage.Save() for a more robust and error-reporting save.
					RobustFile.Copy(bookPath, Path.ChangeExtension(bookPath, "toc.bak"), true);
					XmlHtmlConverter.SaveDOMAsHtml5(dom.RawDom, bookPath);
					MessageBox.Show("Done");
				}
			}
		}
	}
}
