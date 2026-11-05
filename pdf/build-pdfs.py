"""Rebuild the printable Osong lesson set. Requires reportlab, Pillow and pypdf."""
from pathlib import Path
import json
import hashlib
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'pdf'
W, H = 595.276, 841.89
INK = HexColor('#183d36')
TEAL = HexColor('#267965')
PALE = HexColor('#eaf3ed')
YELLOW = HexColor('#f6cf67')
CREAM = HexColor('#faf8ef')
GRAY = HexColor('#54665f')
LINE = HexColor('#b5c7bd')
WEB = 'https://enffl12230-source.github.io/osong-town-classroom/'
pdfmetrics.registerFont(TTFont('Gowun', str(ROOT/'assets/GowunDodum-Regular.ttf')))
pdfmetrics.registerFont(TTFont('Jua', str(ROOT/'assets/Jua-Regular.ttf')))

def txt(c, s, x, y, size=12, font='Gowun', color=INK):
    c.setFillColor(color); c.setFont(font,size); c.drawString(x,y,s)

def wrap(s, size, width, font='Gowun'):
    lines=[]
    for original in s.split('\n'):
        line=''
        for ch in original:
            if pdfmetrics.stringWidth(line+ch,font,size)>width:
                lines.append(line.rstrip()); line=ch.lstrip()
            else: line+=ch
        lines.append(line)
    return lines

def para(c,s,x,y,width,size=12,leading=None,color=INK,font='Gowun'):
    leading=leading or size*1.65
    for line in wrap(s,size,width,font):
        txt(c,line,x,y,size,font,color); y-=leading
    return y

def box(c,x,y,w,h,fill=white,stroke=LINE,r=12):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.setLineWidth(.8)
    c.roundRect(x,y,w,h,r,fill=1,stroke=1)

def line(c,x,y,w,color=LINE):
    c.setStrokeColor(color);c.setLineWidth(.6);c.line(x,y,x+w,y)

def square(c,x,y,label,size=11):
    c.setStrokeColor(TEAL);c.setLineWidth(.9);c.roundRect(x,y-1,9,9,1.5,fill=0,stroke=1)
    txt(c,label,x+15,y,size)

def section(c,n,title,y):
    c.setFillColor(YELLOW);c.circle(50,y+4,12,fill=1,stroke=0)
    txt(c,str(n),46,y,12,'Jua');txt(c,title,70,y-1,17,'Jua')

def top(c,tag,title,subtitle,page,total):
    c.setFillColor(CREAM);c.rect(0,H-131,W,131,fill=1,stroke=0)
    txt(c,'오송 동네 탐험대',38,H-32,12,'Jua',TEAL)
    txt(c,tag,390,H-32,9,'Gowun',GRAY)
    txt(c,title,38,H-76,29,'Jua')
    txt(c,subtitle,39,H-104,11,color=GRAY)
    line(c,38,39,W-76)
    txt(c,'우리 마을 탐험하기 · 2학년 통합교과',39,25,8,color=GRAY)
    c.setFont('Gowun',8);c.setFillColor(GRAY);c.drawRightString(W-39,25,f'{page} / {total}')

def new_pdf(name,title):
    c=canvas.Canvas(str(OUT/name),pagesize=(W,H),pageCompression=1)
    c.setTitle(title);c.setAuthor('오송 동네 탐험대');c.setSubject('2학년 통합교과 우리 마을 탐험하기')
    return c

def map_schematic(c,x,y,w,h,data):
    """Spatial relation diagram based on published place coordinates, not route map."""
    box(c,x,y,w,h,HexColor('#f3f6ef'),LINE)
    # Simple coordinate-based markers; one anchor is shared by the station and lounge.
    c.setFillColor(HexColor('#dae8d7'));c.ellipse(x+15,y+30,x+w*.58,y+h-15,fill=1,stroke=0)
    lats=[p['coords'][0] for p in data];lons=[p['coords'][1] for p in data]
    def pt(p):
        return (x+70+(p['coords'][1]-min(lons))/(max(lons)-min(lons) or 1)*(w-140),
                y+50+(p['coords'][0]-min(lats))/(max(lats)-min(lats) or 1)*(h-90))
    for p in data:
        if p['id']=='sunhamaru':continue
        px,py=pt(p);n=str(p['number']).zfill(2).lstrip('0');name=p.get('shortName',p['name'])
        if p['id']=='station':n='1/2';name='오송역 · 선하마루'
        c.setFillColor(TEAL);c.circle(px,py,13,fill=1,stroke=0)
        txt(c,n,px-pdfmetrics.stringWidth(n,'Jua',11)/2,py-4,11,'Jua',white)
        tw=pdfmetrics.stringWidth(name,'Gowun',10)
        lx=max(x+7,min(px-tw/2-8,x+w-tw-23))
        box(c,lx,py-36,tw+16,18,white,white,5)
        txt(c,name,lx+8,py-31,10)
    txt(c,'북',x+w-25,y+h-28,10,'Jua',TEAL)
    c.setStrokeColor(TEAL);c.setLineWidth(1.8);c.line(x+w-20,y+h-50,x+w-20,y+h-32)
    c.line(x+w-20,y+h-32,x+w-24,y+h-38);c.line(x+w-20,y+h-32,x+w-16,y+h-38)

def worksheet(data):
    c=new_pdf('student-worksheet.pdf','우리 마을 탐험하기 - 학생 활동지')
    top(c,'학생 활동지 01','우리 동네 지도를 만나요','지도와 사진으로 오송의 장소 다섯 곳을 탐험해요.',1,2)
    txt(c,'이름(선택)',39,687,11);line(c,105,683,158)
    txt(c,'탐험한 날',309,687,11);line(c,371,683,183)
    section(c,1,'찾아본 장소에 동그라미 해요',649)
    map_schematic(c,39,358,517,265,data)
    txt(c,'위치 관계를 단순화한 지도 · 축척 없음 · 실제 길찾기 지도가 아니에요.',43,342,9,color=GRAY)
    txt(c,'1·2번: 오송선하마루는 오송역 2층 3번 출구·B주차장 방면에 있어요.',43,328,8.5,color=GRAY)
    section(c,2,'장소와 하는 일을 선으로 이어요',307)
    roles=[data[i]['roleLabel']+'.' for i in [4,2,0,1,3]]
    for yy,p,role in zip([269,239,209,179,149],data,roles):
        name=p.get('shortName',p['name'])
        box(c,43,yy-8,165,25,PALE,PALE,7);txt(c,name,52,yy,11)
        c.setFillColor(TEAL);c.circle(220,yy+3,2,fill=1,stroke=0);c.circle(300,yy+3,2,fill=1,stroke=0)
        txt(c,role,317,yy,11)
    box(c,39,62,517,66,CREAM,CREAM)
    txt(c,'탐험 약속',53,109,12,'Jua')
    para(c,'사진에서 본 것과 내가 생각한 것을 나누어 말해요.\n친구의 발견이 나와 달라도 끝까지 들어요.',53,90,478,10,16)
    c.showPage()
    top(c,'학생 활동지 02','나의 작은 탐험 수첩','글로 써도 좋아요. 그림으로 그려도 좋아요.',2,2)
    section(c,3,'사진에서 발견한 것을 적어요',677)
    rows=[(555,'첫 번째 장소'),(438,'두 번째 장소')]
    for yy,title in rows:
        box(c,39,yy,517,99)
        txt(c,title,52,yy+76,12,'Jua',TEAL);line(c,151,yy+72,386)
        txt(c,'사진에서 본 것',52,yy+45,11);line(c,151,yy+41,386)
        txt(c,'사람들이 하는 일',52,yy+16,11);line(c,151,yy+12,386)
    section(c,4,'친구에게 소개하고 싶은 곳을 그려요',410)
    box(c,39,230,517,153)
    txt(c,'소개할 곳:',52,360,11);line(c,116,356,422)
    txt(c,'이곳이 좋은 까닭은',43,208,11);line(c,153,204,399)
    section(c,5,'우리 마을을 위한 약속 한 가지',174)
    txt(c,'나는',43,142,12);line(c,72,138,480)
    txt(c,'할 거예요.',43,115,12)
    square(c,43,72,'지도로 찾았어요',10)
    square(c,213,72,'사진을 자세히 봤어요',10)
    square(c,405,72,'생각을 나누었어요',10)
    c.save()

def photo(c,path,x,y,w,h):
    from PIL import Image
    with Image.open(path) as im:
        iw,ih=im.size
    scale=min(w/iw,h/ih);dw=iw*scale;dh=ih*scale
    # Embed the source JPEG directly: preserve full frame, aspect ratio and original bytes.
    c.drawImage(str(path),x+(w-dw)/2,y+(h-dh)/2,width=dw,height=dh)

def credits(c,p,x,y,width=510):
    yy=para(c,p['caption'],x,y,width,8,10.5,color=GRAY)
    yy=source_link(c,p['credit'],p['source'],x,yy-2,width,7.5)
    yy=source_link(c,p['license'],p['licenseUrl'],x,yy-1,width,7.5)
    return yy

def source_link(c,label,url,x,y,width=500,size=8):
    yy=para(c,label,x,y,width,size,12,color=GRAY)
    # Keep human-readable labels while embedding clickable source links.
    c.linkURL(url,(x,yy+2,x+width,y+10),relative=0,thickness=0)
    return yy

def exploration(data):
    c=new_pdf('exploration-guide.pdf','우리 마을 탐험하기 - 사진 탐험 자료')
    for page, pair in enumerate([data[:2],data[2:4]],1):
        title='기차역에서 시작하는 탐험' if page==1 else '자연과 건강을 만나는 곳'
        top(c,f'사진 학습자료 0{page}',title,'사진을 크게 보고, 보이는 것 두 가지를 찾아 말해요.',page,3)
        for yy,p in zip([414,145],pair):
            txt(c,p['number']+'  '+p['name'],39,yy+248,20,'Jua')
            photo(c,ROOT/p['photo'],39,yy+83,255,148)
            para(c,p['description'],313,yy+216,236,11,17)
            txt(c,'생각해 보아요',313,yy+125,12,'Jua',TEAL)
            para(c,p['question'],313,yy+103,236,10.5,16)
            credits(c,p,41,yy+68)
        box(c,39,62,517,63,PALE,PALE)
        txt(c,'발견 말하기',52,104,13,'Jua')
        txt(c,'“사진에서 __________을/를 봤어요. __________이/가 궁금해요.”',52,82,11)
        c.showPage()
    top(c,'사진 학습자료 03','마을 생활을 돕는 곳','장소에서 사람들이 하는 일을 생각해 보아요.',3,3)
    p=data[4]
    txt(c,p['number']+'  '+p['name'],39,669,21,'Jua')
    photo(c,ROOT/p['photo'],39,446,300,200)
    txt(c,'자세히 보아요',358,624,14,'Jua',TEAL)
    para(c,p['observe'],358,595,193,11.5,20)
    cy=credits(c,p,41,430)
    para(c,p['description'],40,min(cy-20,358),514,12,20)
    box(c,39,207,517,90,PALE,PALE)
    txt(c,'생각해 보아요',53,275,14,'Jua',TEAL)
    para(c,p['question'],53,250,480,13,21)
    txt(c,'눈으로 본 것과 생각한 것을 나누어요',40,174,16,'Jua')
    para(c,'사진에 사람이 보이지 않아도 괜찮아요.\n“사진에는 무엇이 보이나요?”와 “사람들은 무엇을 할까요?”는 다른 질문이에요.\n사진을 찍었을 때와 지금의 모습은 다를 수 있어요.',40,148,515,11,19)
    txt(c,'웹페이지에서 실제 위치와 사진을 함께 살펴보세요.',40,75,10,color=GRAY)
    source_link(c,WEB,WEB,40,60,515,8)
    c.save()

def teachers(data):
    c=new_pdf('teacher-guide.pdf','우리 마을 탐험하기 - 교사용 40분 수업 안내')
    top(c,'교사용 안내 01','교실에서 만나는 우리 마을','초등 2학년 · 2022 개정 통합교과 · 1차시 40분',1,2)
    txt(c,'교육과정 연결',39,682,17,'Jua')
    box(c,39,562,517,101,PALE,PALE)
    para(c,'핵심 [2슬02-01] 우리가 살고 있는 마을과 사람들이 생활하는 모습을 살펴본다.\n보조 [2슬02-04] 궁금한 세계를 다양한 매체로 탐색한다.\n연계 [2바02-01] 공동체에서 내가 할 수 있는 일을 찾아보고 실천한다.',52,640,490,11,20)
    txt(c,'영역: 우리는 어디서 살아갈까 · 1-2학년군 · 특정 교과서 차시 번호는 부여하지 않음',40,545,9,color=GRAY)
    txt(c,'수업 목표',39,514,17,'Jua')
    para(c,'1. 지도에서 우리 동네의 장소를 두 곳 이상 찾는다.\n2. 사진에서 발견한 단서로 장소의 모습과 역할을 설명한다.\n3. 우리 마을을 위해 내가 할 수 있는 일을 한 가지 정한다.',40,490,510,11,21)
    txt(c,'40분 수업 흐름',39,407,17,'Jua')
    stages=[('5분','출발하기','가 본 장소를 이야기하고 탐험 약속을 정합니다.'),('5분','지도 읽기','지도의 기호와 이름을 연결하고 두 곳을 찾습니다.'),('15분','사진 탐험','다섯 곳을 각 3분씩 살펴봅니다. 보이는 것 → 하는 일.'),('10분','기록하기','활동지에 연결하고, 두 곳을 기록하고, 소개할 곳을 그립니다.'),('5분','나누기','발견 한 가지와 우리 마을을 위한 약속을 나눕니다.')]
    for i,(tm,title,desc) in enumerate(stages):
        yy=370-i*48
        if i%2==0: box(c,39,yy-14,517,44,CREAM,CREAM,6)
        txt(c,tm,51,yy+4,13,'Jua',TEAL);txt(c,title,104,yy+4,12,'Jua')
        para(c,desc,193,yy+5,350,10.5,15)
    txt(c,'준비',39,102,12,'Jua')
    para(c,'학생 1인 1태블릿, 웹페이지, A4 활동지 2쪽, 연필과 색연필.\n인터넷이 불안정하면 미리 받은 사진 PDF와 그림지도로 진행합니다.',80,102,473,10.5,18)
    c.showPage()
    top(c,'교사용 안내 02','관찰을 돕고, 배움을 살펴요','빠르게 많이 누르기보다 한 장의 사진을 자세히 봅니다.',2,2)
    txt(c,'장소별 대화의 실마리',39,680,17,'Jua')
    y=651
    for p in sorted(data,key=lambda p:p['number']):
        txt(c,p.get('shortName',p['name']),41,y,11,'Jua',TEAL)
        para(c,p['role'],188,y,365,9.3,14)
        y-=42
    txt(c,'학생의 다양한 표현을 받아 주세요',39,y,17,'Jua');y-=26
    y=para(c,'쓰기가 어려운 학생은 그림, 말, 짝 받아쓰기로 표현합니다. 사진에 없는 행동을 본 것처럼 말하게 하지 않습니다. 관찰과 상상을 구분하되, 장소의 역할을 생각하는 답은 여러 가지가 가능합니다.',40,y,510,10.5,17)-15
    txt(c,'관찰 평가',39,y,17,'Jua');y-=25
    for s in ['지도에서 장소 이름이나 기호를 찾아 설명한다.','사진에 보이는 단서를 하나 이상 들어 장소를 설명한다.','마을에서 할 수 있는 구체적인 행동을 말한다.']:
        square(c,42,y,s,11);y-=26
    y=para(c,'도움 수준: 혼자 할 수 있어요 / 도움을 받으면 할 수 있어요 / 다음에 더 해 봐요\n탐험 스탬프의 개수나 속도는 성취 평가로 사용하지 않습니다.',40,y,513,9.5,16)-15
    txt(c,'자료 출처와 이용 안내',39,y,17,'Jua');y-=25
    y=para(c,'교육과정: curriculum-kr MCP get_standard 공식 원문 확인(2026-11-05). 교육부 고시 제2022-33호 별책 15에 연결됩니다. 그림지도는 실제 장소의 위치 관계를 단순화했으며, 축척과 실제 보행 경로를 나타내지 않습니다.',40,y,512,8.5,13)-5
    y=para(c,'사진은 전체 화면과 원래 비율을 보존했습니다. 사진별 저작자·촬영일 또는 게시일·이용 조건은 사진 학습자료(총 3쪽)의 원문과 이용허락 링크에서 확인할 수 있습니다.',40,y,513,8,12)-2
    y=source_link(c,'교육과정 MCP 저장소 / 성취기준과 공식 원문 출처', 'https://github.com/taehyeonglim/korean-elementary-learning-map-mcp',40,y,513,8)-2
    source_link(c,WEB,WEB,40,y,513,8)
    c.save()

def main():
    canonical=json.loads((ROOT/'data/places.json').read_text(encoding='utf-8'))
    data=[]
    for p in canonical['places']:
        ph=p['photo']
        data.append({**p,'number':str(p['number']).zfill(2),'description':p['desc'],
                     'role':p['pdfRole'],'photo':ph['src'],'caption':ph['caption'],
                     'credit':f"사진: {ph['author']} / {ph['title']} / 전체 화면·원본 비율 유지",
                     'source':ph['sourceUrl'],'license':ph['license'],'licenseUrl':ph['licenseUrl']})
    assert len(data)==5
    assert [p['id'] for p in data]==['station','sunhamaru','park','health','center']
    for p in data: assert (ROOT/p['photo']).is_file(),p['photo']
    worksheet(data);exploration(data);teachers(data)
    writer=PdfWriter()
    for name,expected_pages in [('student-worksheet.pdf',2),('exploration-guide.pdf',3),('teacher-guide.pdf',2)]:
        reader=PdfReader(OUT/name)
        assert len(reader.pages)==expected_pages,(name,len(reader.pages))
        for page in reader.pages: assert len(page.extract_text())>100
        writer.append(reader)
    writer.add_metadata({'/Title':'우리 마을 탐험하기 - 1차시 전체 자료','/Author':'오송 동네 탐험대'})
    with open(OUT/'full-set.pdf','wb') as f: writer.write(f)
    # Validate source-image preservation in the actual written PDF, not a re-encoded export.
    original_hashes={hashlib.sha256((ROOT/p['photo']).read_bytes()).hexdigest() for p in data}
    embedded_hashes=set()
    for page in PdfReader(OUT/'full-set.pdf').pages:
        for obj in page['/Resources'].get('/XObject',{}).values():
            obj=obj.get_object()
            if obj.get('/Subtype')=='/Image':
                embedded_hashes.add(hashlib.sha256(obj.get_data()).hexdigest())
    assert embedded_hashes==original_hashes,'Embedded original JPEG bytes changed'
    print(json.dumps({name: {'pages':len(PdfReader(OUT/name).pages),'bytes':(OUT/name).stat().st_size} for name in ['student-worksheet.pdf','exploration-guide.pdf','teacher-guide.pdf','full-set.pdf']},ensure_ascii=False))

if __name__=='__main__':main()
