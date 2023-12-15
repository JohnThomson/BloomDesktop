using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Bloom.Book
{
    /// <summary>
    /// This trivial class is used to store the content of one file, along with a flag indicating whether it has been modified.
    /// </summary>
    internal class FileCache
    {
        public bool Modified;

        // Currently we only set this when we ned to update it.
        public string SourcePath;

        public byte[] BinaryData;

        // Many FileCache instances store text (e.g., CSS). But we also store image data, and we can't
        // readily store that in  a string field (some byte sequences are not valid UTF-8).
        // I tried using a string field to store text and a binary one to store images, but
        // various bits of code get more complicated. Most clients actually want binary data,
        // even for text (e.g., it's what we read from disk, write to disk, and return
        // as a stream through our server to the browser). So I ended up always storing
        // in binary. Currently this property is not used at all by code; it just makes
        // debugging easier by providing a readable version of any data that is text.
        public string TextData => Encoding.UTF8.GetString(BinaryData);
    }
}
