﻿using System.Xml;

namespace Bloom.SafeXml
{
    // The EpubMaker.DoRemoveFontSizes method uses this class.
    internal class SafeXmlCDataSection : SafeXmlCharacterData
    {
        public SafeXmlCDataSection(XmlNode node, SafeXmlDocument doc) : base(node, doc)
        {
        }
    }
}
