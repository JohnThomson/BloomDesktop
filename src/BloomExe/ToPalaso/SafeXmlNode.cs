using System;
using System.Collections.Generic;
using System.Diagnostics.Eventing.Reader;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using SIL.Code;
using SIL.Xml;

namespace Bloom.ToPalaso
{
    public class SafeXmlNode
    {
        internal readonly XmlNode _node;

        // I want this to be readonly, but can't find a way to make the constructor of SafeXmlDocument work.
        internal SafeXmlDocument _doc;

        // Usually should instead call WrapNode; only for subclass constructors
        protected SafeXmlNode(XmlNode node, SafeXmlDocument doc)
        {
            _node = node;
            _doc = doc;
        }

        public SafeXmlNode ParentNode
        {
            get
            {
                lock (_doc.Lock)
                    return WrapNode(_node.ParentNode, _doc);
            }
        }

        public SafeXmlNode RemoveChild(SafeXmlNode child)
        {
            lock (_doc.Lock)
            {
                _node.RemoveChild(child._node);
                return child; // what the original does; we don't need to make a new one.
            }
        }

        public SafeXmlNode ReplaceChild(SafeXmlNode newChild, SafeXmlNode oldChild)
        {
            lock (_doc.Lock)
            {
                _node.ReplaceChild(newChild._node, oldChild._node);
                return oldChild; // what the original does; we don't need to make a new one.
            }
        }

        public SafeXmlNode InsertBefore(SafeXmlNode newChild, SafeXmlNode refChild)
        {
            lock (_doc.Lock)
            {
                _node.InsertBefore(newChild._node, refChild._node);
                return newChild; // what the original does; we don't need to make a new one.
            }
        }

        public SafeXmlNode InsertAfter(SafeXmlNode newChild, SafeXmlNode refChild)
        {
            lock (_doc.Lock)
            {
                _node.InsertAfter(newChild._node, refChild._node);
                return newChild; // what the original does; we don't need to make a new one.
            }
        }

        public string Name
        {
            get
            {
                lock (_doc.Lock)
                    return _node.Name;
            }
        }

        public string OuterXml
        {
            get
            {
                lock (_doc.Lock)
                    return _node.OuterXml;
            }
        }

        public virtual SafeXmlNode AppendChild(SafeXmlNode newChild)
        {
            lock (_doc.Lock)
            {
                _node.AppendChild(newChild._node);
                return newChild; // what the original does; we don't need to make a new one.
            }
        }

        public string InnerText
        {
            get
            {
                lock (_doc.Lock)
                    return _node.InnerText;
            }
            set
            {
                lock (_doc.Lock)
                    _node.InnerText = value;
            }
        }

        public string InnerXml
        {
            get
            {
                lock (_doc.Lock)
                    return _node.InnerXml;
            }
            set
            {
                lock (_doc.Lock)
                    _node.InnerXml = value;
            }
        }

        public SafeXmlNode[] ChildNodes
        {
            get
            {
                lock (_doc.Lock)
                    return WrapNodes(_node.ChildNodes, _doc);
            }
        }

        public SafeXmlNode FirstChild
        {
            get
            {
                lock (_doc.Lock)
                    return WrapNode(_node.FirstChild, _doc);
            }
        }

        public bool HasChildNodes
        {
            get
            {
                lock (_doc.Lock)
                    return _node.HasChildNodes;
            }
        }

        public SafeXmlDocument OwnerDocument => _doc;

        public SafeXmlNode Clone()
        {
            lock (_doc.Lock)
                return WrapNode(_node.Clone(), _doc);
        }

        public SafeXmlNode CloneNode(bool deep)
        {
            lock (_doc.Lock)
                return WrapNode(_node.CloneNode(deep), _doc);
        }

        #region Addional Methods

        /// <summary>
        /// Overridden in SafeXmlElement, which actually has attributes.
        /// </summary>
        public virtual string GetAttribute(string name)
        {
            return null;
        }

        public virtual void SetAttribute(string name, string value)
        {
            throw new NotImplementedException("Only Elements have attributes");
        }

        public virtual bool HasAttribute(string name)
        {
            return false; // Nodes never do; we just allow it to make iterating over node lists easier.
        }

        public SafeXmlNode[] SafeSelectNodes(string xpath)
        {
            lock (_doc.Lock)
                return WrapNodes(_node.SafeSelectNodes(xpath), _doc);
        }

        /// <summary>
        /// Convert the input to SafeXmlNode objects (using the appropriate subclasses as necessary)
        /// </summary>
        public static SafeXmlNode[] WrapNodes(XmlNodeList input, SafeXmlDocument doc)
        {
            return WrapNodes(input.Cast<XmlNode>(), doc);
        }

        public static SafeXmlNode[] WrapNodes(IEnumerable<XmlNode> input, SafeXmlDocument doc)
        {
            return input.Select(node => WrapNode(node, doc)).ToArray();
        }

        public static SafeXmlNode WrapNode(XmlNode node, SafeXmlDocument doc)
        {
            if (node == null)
                return null;
            if (node is XmlElement elt)
                return new SafeXmlElement(elt, doc);
            else if (node is XmlText txt)
                return new SafeXmlText(txt, doc);
            // Enhance: if we use more subtypes add more cases

            Guard.Against(
                node.GetType() != typeof(XmlNode),
                "trying to convert an unexpected type of XmlNode"
            );
            return new SafeXmlNode(node, doc);
        }

        /// <summary>
        /// This is useful when an element does not need to be thread-safe (e.g., a node from
        /// a document that only exists in local variables on one thread), but an API calls for
        /// SafeXmlNode.
        /// </summary>
        public static SafeXmlNode FakeWrap(XmlNode node)
        {
            return WrapNode(node, new SafeXmlDocument(new XmlDocument()));
        }

        public SafeXmlNode SelectSingleNode(string xpath)
        {
            lock (_doc.Lock)
                return WrapNode(_node.SelectSingleNode(xpath), _doc);
        }

        /// <summary>
        /// This is a much simpler object than wrapping Attributes for many cases where we need a list.
        /// Hoping we don't need to make a SafeXmlAttributeList class.
        /// </summary>
        public string[] AttributeNames
        {
            get
            {
                lock (_doc.Lock)
                    return _node.Attributes
                        .Cast<XmlAttribute>()
                        .Select(attr => attr.Name)
                        .ToArray();
            }
        }

        /// <summary>
        /// Another way to get at the name and value of each attr, without the overhead
        /// of wrapping XmlAttributeList or XmlAttribute.
        /// </summary>
        public NameValue[] AttributePairs
        {
            get
            {
                lock (_doc.Lock)
                    return _node.Attributes
                        .Cast<XmlAttribute>()
                        .Select(attr => new NameValue(attr.Name, attr.Value))
                        .ToArray();
            }
        }

        //public XmlNode ClonedNode
        //{
        //    get
        //    {
        //        lock(_doc.Lock)
        //            return _node.CloneNode(true);
        //    }
        //};

        #endregion
    }
}
