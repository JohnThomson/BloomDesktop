using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;

namespace Bloom.ToPalaso
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
