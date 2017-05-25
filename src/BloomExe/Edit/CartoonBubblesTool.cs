using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Bloom.Edit
{
    class CartoonBubblesTool : ToolboxTool
    {
        public const string StaticToolId = "cartoonBubbles";  // Avoid changing value; see ToolboxTool.JsonToolId
        public override string ToolId { get { return StaticToolId; } }
    }
}
