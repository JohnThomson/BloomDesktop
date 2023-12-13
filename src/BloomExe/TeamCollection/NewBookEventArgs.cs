﻿namespace Bloom.TeamCollection
{
    // Arguments for the NewBook event in ITeamRepo. No actual different data, but it's
    // useful to know the type of event as they are handled slightly differently.
    public class NewBookEventArgs : BookRepoChangeEventArgs { }
}
