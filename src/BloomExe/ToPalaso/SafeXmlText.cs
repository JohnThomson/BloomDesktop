using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;

namespace Bloom.ToPalaso
{
    public class SafeXmlText : SafeXmlNode
    {
        public SafeXmlText(XmlNode node, SafeXmlDocument doc)
            : base(node, doc) { }

        public string Value
        {
            get
            {
                lock (_doc.Lock)
                    return ((XmlText)_node).Value;
            }
            set
            {
                lock (_doc.Lock)
                    ((XmlText)_node).Value = value;
            }
        }
    }
}
