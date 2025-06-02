# PNG to multi-page PDF

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import argparse
from PIL import Image

# input is a tall skinny PDF.  Break it into pages, where each page is a section of the PNG that
# has an aspect ratio of 7x10

def create_pdf(png_file, output_pdf):
    c = canvas.Canvas(output_pdf)
    src_image = Image.open(png_file)
    width, height = src_image.size


    # if width is output as 7 inches, page_height willnumber of pages will be height*scale / 10
    src_width = width
    src_height = width*10/7

    nbr_pages = int(height / src_height) + 1
    print(f"nbr_pages: {nbr_pages} src_height: {src_height} height: {height}")

    for page in range(nbr_pages):
        src_x = 0
        src_y = page * src_height
        src_width = width
        src_height = width*10/7

        cropped = Image.open(png_file).crop((src_x, src_y, src_x + src_width, min(height, src_y + src_height)))
        cropped_width, cropped_height = cropped.size
        scale = 7*72/cropped_width
        cropped.save(f"/tmp/cropped_{page}.png")

        c.drawImage(f"/tmp/cropped_{page}.png", 0.5*72, 0.5*72, width=cropped_width*scale, height=cropped_height*scale)
        c.showPage()

    c.save()

parser = argparse.ArgumentParser()
parser.add_argument("png_file", help="The PNG file to convert to a PDF")
parser.add_argument("output_pdf", help="The output PDF file")
args = parser.parse_args()

create_pdf(args.png_file, args.output_pdf)