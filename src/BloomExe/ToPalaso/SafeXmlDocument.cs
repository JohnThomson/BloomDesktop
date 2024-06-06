using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using SIL.Xml;

namespace Bloom.ToPalaso
{
    /// <summary>
    /// A wrapper around XmlDocument to make it thread-safe.
    /// Methods of this and its related classes have much of the API of XmlDocument and its friends,
    /// but anything that returns something like XmlElement in the original API will instead return and appropriate
    /// SafeXmlElement (unless it is making a clone).
    /// Where relevant, if an object that can be wrapped is an input argument, we will provide overloads
    /// that take either the wrapped or unwrapped version.
    /// It's also convenient to add some methods of our own, and to make ones that return the annoying
    /// XmlNodeList type return an array (which also ensures the entire process of enumerating
    /// happens inside the lock).
    /// </summary>
    public class SafeXmlDocument : SafeXmlNode
    {
        private XmlDocument Doc => (XmlDocument)_node;
        internal object Lock = new object();

        public SafeXmlDocument(XmlDocument doc)
            : base(doc, null)
        {
            _doc = this;
        }

        public void LoadXml(string xml)
        {
            lock (Lock)
                Doc.LoadXml(xml);
        }

        public bool PreserveWhitespace
        {
            get
            {
                lock (Lock)
                    return Doc.PreserveWhitespace;
            }
            set
            {
                lock (Lock)
                    Doc.PreserveWhitespace = value;
            }
        }

        public string InnerXml
        {
            get
            {
                lock (Lock)
                    return Doc.InnerXml;
            }
            // hopefully we don't need this???
            //set
            //{
            //    lock (Lock)
            //        Doc.InnerXml = value;
            //}
        }

        public SafeXmlDocument Clone()
        {
            lock (Lock)
                return new SafeXmlDocument((XmlDocument)Doc.Clone());
        }

        public SafeXmlNode SelectSingleNode(string xpath)
        {
            lock (Lock)
            {
                var node = Doc.SelectSingleNode(xpath);
                if (node == null)
                    return null;
                return WrapNode(node, this);
            }
        }

        public SafeXmlElement CreateElement(string name)
        {
            lock (Lock)
                return new SafeXmlElement(Doc.CreateElement(name), this);
        }

        #region Addional Methods

        public SafeXmlElement GetOrCreateElement(string parentPath, string name)
        {
            lock (Lock)
                return new SafeXmlElement(XmlUtils.GetOrCreateElement(Doc, parentPath, name), this);
        }

        public string GetTitleOfHtml(string defaultIfMissing)
        {
            lock (Lock)
                return XmlUtils.GetTitleOfHtml(Doc, defaultIfMissing);
        }

        public SafeXmlNode[] SafeSelectNodes(string xpath)
        {
            lock (Lock)
                return SafeXmlNode.WrapNodes(Doc.SafeSelectNodes(xpath), this);
        }

        public SafeXmlElement DocumentElement
        {
            get
            {
                lock (Lock)
                    return new SafeXmlElement(Doc.DocumentElement, this);
            }
        }

        public SafeXmlNode ImportNode(SafeXmlNode node, bool deep)
        {
            lock (Lock)
                return WrapNode(Doc.ImportNode(node._node, deep), this);
        }

        public void WriteContentTo(XmlWriter writer)
        {
            lock (Lock)
                Doc.WriteContentTo(writer);
        }

        /// <summary>
        /// This is for doing selections in xhtml, where there is a default namespace, which makes
        /// normal selects fail.  This tries to set a namespace and inject prefix into the xpath.
        /// </summary>
        public SafeXmlNode SelectSingleNodeHonoringDefaultNS(string path)
        {
            lock (Lock)
                return WrapNode(Doc.SelectSingleNodeHonoringDefaultNS(path), this);
        }

        public SafeXmlElement Body
        {
            get
            {
                lock (Lock)
                    return GetOrCreateElement("html", "body");
            }
        }

        public SafeXmlElement Head
        {
            get
            {
                lock (Lock)
                    return GetOrCreateElement("html", "head");
            }
        }

        public void RemoveClassFromBody(string className)
        {
            lock (Lock)
                Body.RemoveClass(className);
        }

        public void AddClassToBody(string className)
        {
            lock (Lock)
                Body.AddClass(className);
        }

        public void RemoveStyleSheetIfFound(string path)
        {
            lock (Lock)
            {
                XmlDomExtensions.RemoveStyleSheetIfFound(Doc, path);
            }
        }

        /// <summary>
        /// Get a new namespace manager for this document.
        /// Note: you get a new one every time!
        /// Note: we haven't wrapped the XmlNamespaceManager, so you can't change the namespaces,
        /// so it should not be used on any DOM that is shared across threads to modify the document.
        /// </summary>
        public XmlNamespaceManager GetNewNamespaceManager()
        {
            lock (Lock)
                return new XmlNamespaceManager(Doc.NameTable);
        }

        /// <summary>
        /// This shortcut saves us trying to wrap XmlNamespaceManager
        /// </summary>
        /// <param name="prefix"></param>
        /// <param name="uri"></param>
        //public void AddNameSpace(string prefix, string uri)
        //{
        //    lock (Lock)
        //    {
        //        var nsManager = new XmlNamespaceManager(Doc.NameTable);
        //        nsManager.AddNamespace(prefix, uri);
        //    }
        //}
        #endregion
    }
}
