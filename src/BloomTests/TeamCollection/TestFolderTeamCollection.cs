﻿using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Bloom.TeamCollection;

namespace BloomTests.TeamCollection
{
	public class TestFolderTeamCollection : FolderTeamCollection
	{
		public TestFolderTeamCollection(ITeamCollectionManager tcManager, string localCollectionFolder, string repoFolderPath) : base(tcManager, localCollectionFolder, repoFolderPath)
		{
		}

		public Action OnCreatedCalled;
		public Action OnChangedCalled;

		protected override void OnCreated(object sender, FileSystemEventArgs e)
		{
			base.OnCreated(sender, e);
			OnCreatedCalled?.Invoke();
		}

		protected override void OnChanged(object sender, FileSystemEventArgs e)
		{
			base.OnChanged(sender, e);
			OnChangedCalled?.Invoke();
		}

		protected override bool CheckRecentNotification()
		{
			// For unit testing we don't want to ignore rapid sequences of changes.
			return false;
		}
	}
}
