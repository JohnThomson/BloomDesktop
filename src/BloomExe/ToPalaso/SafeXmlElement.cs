using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Xml;
using Bloom.Book;
using SIL.Xml;

namespace Bloom.ToPalaso
{
    public class SafeXmlElement : SafeXmlLinkedNode
    {
        public SafeXmlElement(XmlElement element, SafeXmlDocument doc)
            : base(element, doc) { }

        // In this class, _node is always an XmlElement, since it is readonly and set by our constructor, which requires that.
        // This saves us from having to cast it in every method.
        private XmlElement Element => (XmlElement)_node;

        public string InnerXml
        {
            get
            {
                lock (_doc.Lock)
                    return Element.InnerXml;
            }
            // Enhance: can we possibly do without this?
            set
            {
                lock (_doc.Lock)
                    Element.InnerXml = value;
            }
        }

        public string InnerText
        {
            get
            {
                lock (_doc.Lock)
                    return Element.InnerText;
            }
            // Enhance: can we possibly do without this?
            set
            {
                lock (_doc.Lock)
                    Element.InnerText = value;
            }
        }

        public override string GetAttribute(string name)
        {
            lock (_doc.Lock)
                return Element.GetAttribute(name);
        }

        public override void SetAttribute(string name, string value)
        {
            lock (_doc.Lock)
                Element.SetAttribute(name, value);
        }

        public SafeXmlNode[] SafeSelectNodes(string xpath)
        {
            lock (_doc.Lock)
                return SafeXmlNode.WrapNodes(Element.SafeSelectNodes(xpath), _doc);
        }

        public SafeXmlNode[] SafeSelectNodes(string xpath, XmlNamespaceManager ns)
        {
            lock (_doc.Lock)
                return SafeXmlNode.WrapNodes(Element.SafeSelectNodes(xpath, ns), _doc);
        }

        public void RemoveAttribute(string name)
        {
            lock (_doc.Lock)
                Element.RemoveAttribute(name);
        }

        public SafeXmlNode AppendChild(SafeXmlNode child)
        {
            lock (_doc.Lock)
            {
                Element.AppendChild(child._node);
                return child;
            }
        }

        /// <summary>
        /// Despite the name, which is to reflect the original XmlElement property,
        /// this is really about whether, IF it has no children, it will be written as <foo></foo>(false) or <foo/> (true).
        /// </summary>
        public bool IsEmpty
        {
            get
            {
                lock (_doc.Lock)
                    return Element.IsEmpty;
            }
            set
            {
                lock (_doc.Lock)
                    Element.IsEmpty = value;
            }
        }

        public override bool HasAttribute(string name)
        {
            lock (_doc.Lock)
                return Element.HasAttribute(name);
        }

        public SafeXmlElement[] GetElementsByTagName(string name)
        {
            lock (_doc.Lock)
                return SafeXmlElement.WrapElements(Element.GetElementsByTagName(name), _doc);
        }

        #region Additional Methods

        /// <summary>
        /// For HTML, return true if the class attribute contains the given class.
        /// </summary>

        public bool HasClass(string className)
        {
            lock (_doc.Lock)
                return HtmlDom.HasClass(Element, className);
        }

        public void AddClass(string className)
        {
            lock (_doc.Lock)
            {
                if (HasClass(className))
                    return;
                SetAttribute("class", (GetAttribute("class").Trim() + " " + className).Trim());
            }
        }

        public void RemoveClass(string classNameToRemove)
        {
            lock (_doc.Lock)
            {
                var classes = GetClasses().ToList();
                if (classes.Count == 0)
                {
                    return;
                }
                classes.Remove(classNameToRemove);
                string newClassAttributeValue = String.Join(" ", classes);
                SetAttribute("class", newClassAttributeValue);
            }
        }

        public string[] GetClasses()
        {
            lock (_doc.Lock)
            {
                return GetAttribute("class")
                    .Split(HtmlDom.kHtmlClassDelimiters, StringSplitOptions.RemoveEmptyEntries);
            }
        }

        public string GetOptionalStringAttribute(string name, string defaultValue)
        {
            lock (_doc.Lock)
                return Element.GetOptionalStringAttribute(name, defaultValue);
        }

        /// <summary>
        /// Make an array of SafeXmlElements from an XmlNodeList that is the output of a query
        /// like SelectNodes where the xpath is known to only return elements.
        /// </summary>
        /// <param name="input"></param>
        /// <param name="doc"></param>
        /// <returns></returns>
        static SafeXmlElement[] WrapElements(XmlNodeList input, SafeXmlDocument doc)
        {
            return WrapElements(input.Cast<XmlNode>(), doc);
        }

        static SafeXmlElement[] WrapElements(IEnumerable<XmlNode> input, SafeXmlDocument doc)
        {
            lock (doc.Lock)
                return input.Select(node => new SafeXmlElement((XmlElement)node, doc)).ToArray();
        }

        public static SafeXmlElement WrapElement(XmlElement elt, SafeXmlDocument doc)
        {
            if (elt == null)
                return null;
            return new SafeXmlElement(elt, doc);
        }

        /// <summary>
        /// This is useful when an element does not need to be thread-safe (e.g., a node from
        /// a document that only exists in local variables on one thread), but an API calls for
        /// SafeXmlNode.
        /// </summary>
        public static SafeXmlElement FakeWrap(XmlElement elt)
        {
            return (SafeXmlElement)SafeXmlNode.FakeWrap(elt);
        }
        #endregion
    }
}
