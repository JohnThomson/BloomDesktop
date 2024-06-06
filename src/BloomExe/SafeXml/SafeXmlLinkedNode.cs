﻿using System.Xml;

namespace Bloom.SafeXml
{
    /// <summary>
    /// This is just to imitate the original XmlElement class hierarchy.
    /// </summary>
    public class SafeXmlLinkedNode : SafeXmlNode
    {
        public SafeXmlLinkedNode(XmlNode node, SafeXmlDocument doc)
            : base(node, doc) { }
    }
}
