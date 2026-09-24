#!/usr/bin/env python3
"""Extract full text from the main page prompt docx."""
import sys
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

PATH = "/home/z/my-project/upload/SakhMatrix_Промт_главной_страницы_финальная_версия.docx"

doc = Document(PATH)

def iter_block_items(parent):
    """Yield paragraphs and tables in document order."""
    from docx.oxml.ns import qn
    parent_elm = parent.element.body
    for child in parent_elm.iterchildren():
        if child.tag == qn('w:p'):
            yield Paragraph(child, parent)
        elif child.tag == qn('w:tbl'):
            yield Table(child, parent)

out = []
for block in iter_block_items(doc):
    if isinstance(block, Paragraph):
        text = block.text.strip()
        if text:
            style = block.style.name if block.style else ""
            prefix = ""
            if "Heading" in style or "Заголовок" in style:
                prefix = f"[{style}] "
            out.append(prefix + text)
    elif isinstance(block, Table):
        out.append("--- TABLE ---")
        for row in block.rows:
            cells = [c.text.strip().replace("\n", " / ") for c in row.cells]
            out.append(" | ".join(cells))
        out.append("--- END TABLE ---")

full = "\n".join(out)
print(full)
print(f"\n=== TOTAL CHARS: {len(full)} ===", file=sys.stderr)
