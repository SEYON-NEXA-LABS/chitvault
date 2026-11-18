import math
from PIL import Image, ImageDraw

def render_option2(size=512, bg_mode='white'):
    scale = 4
    dim = size * scale
    
    if bg_mode == 'transparent':
        img = Image.new('RGBA', (dim, dim), (0, 0, 0, 0))
    else:
        img = Image.new('RGBA', (dim, dim), (255, 255, 255, 255))
        
    draw = ImageDraw.Draw(img)
    cx, cy = dim / 2, dim / 2
    
    # 1. Rounded Hexagon Outer Halo Ring
    r_hex = dim * 0.43
    corner_r = dim * 0.08
    angles = [math.radians(60 * i - 30) for i in range(6)]
    pts = [(cx + r_hex * math.cos(a), cy + r_hex * math.sin(a)) for a in angles]
    
    smooth_hex = []
    n = len(pts)
    for i in range(n):
        p_prev = pts[(i - 1) % n]
        p_curr = pts[i]
        p_next = pts[(i + 1) % n]
        
        v_prev = (p_prev[0] - p_curr[0], p_prev[1] - p_curr[1])
        l_prev = math.hypot(*v_prev)
        u_prev = (v_prev[0] / l_prev, v_prev[1] / l_prev)
        
        v_next = (p_next[0] - p_curr[0], p_next[1] - p_curr[1])
        l_next = math.hypot(*v_next)
        u_next = (v_next[0] / l_next, v_next[1] / l_next)
        
        start_pt = (p_curr[0] + u_prev[0] * corner_r, p_curr[1] + u_prev[1] * corner_r)
        end_pt = (p_curr[0] + u_next[0] * corner_r, p_curr[1] + u_next[1] * corner_r)
        
        for t in [j / 12.0 for j in range(13)]:
            bx = (1-t)**2 * start_pt[0] + 2*(1-t)*t * p_curr[0] + t**2 * end_pt[0]
            by = (1-t)**2 * start_pt[1] + 2*(1-t)*t * p_curr[1] + t**2 * end_pt[1]
            smooth_hex.append((bx, by))
            
    c_ring = (56, 189, 248) # #38bdf8 Vibrant Sky Cyan Halo
    draw.polygon(smooth_hex, outline=c_ring, width=int(dim * 0.038))
    
    # 2. Passbook Body (Deep ChitVault Royal Blue)
    bw = dim * 0.44
    bh = dim * 0.58
    bx1 = cx - bw / 2
    bx2 = cx + bw / 2
    by1 = cy - bh / 2 + dim * 0.015
    by2 = cy + bh / 2 + dim * 0.015
    book_r = int(dim * 0.065)
    
    c_book = (0, 77, 184) # #004db8 Deep Blue
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=book_r, fill=c_book)
    
    # 3. Passbook Bottom Page Edge (Clean White Curved Strip)
    page_pad_x = dim * 0.04
    page_pad_y = dim * 0.035
    page_h = dim * 0.065
    draw.rounded_rectangle(
        [bx1 + page_pad_x, by2 - page_pad_y - page_h, bx2 - page_pad_x, by2 - page_pad_y],
        radius=int(page_h / 2),
        fill=(255, 255, 255)
    )
    
    # 4. Indian Rupee (₹) Symbol (Crisp Geometric White Vector)
    rcx = cx
    rcy = cy - dim * 0.055
    rw = dim * 0.22
    rh = dim * 0.26
    stroke = int(dim * 0.034)
    
    top_y = rcy - rh / 2
    bar2_y = top_y + rh * 0.32
    loop_bot_y = top_y + rh * 0.62
    stem_x = rcx - rw * 0.36
    
    # Top horizontal bar
    draw.line([(stem_x - dim*0.01, top_y), (rcx + rw * 0.48, top_y)], fill=(255, 255, 255), width=stroke)
    # Second horizontal bar
    draw.line([(stem_x - dim*0.01, bar2_y), (rcx + rw * 0.36, bar2_y)], fill=(255, 255, 255), width=stroke)
    # Vertical stem
    draw.line([(stem_x + stroke/2, top_y), (stem_x + stroke/2, loop_bot_y)], fill=(255, 255, 255), width=stroke)
    # Semi-circular loop
    draw.arc(
        [stem_x - dim*0.01, top_y, rcx + rw * 0.36, loop_bot_y],
        start=270,
        end=90,
        fill=(255, 255, 255),
        width=stroke
    )
    # Slanted diagonal leg
    leg_start_x = stem_x + rw * 0.12
    leg_start_y = loop_bot_y - stroke * 0.2
    leg_end_x = rcx + rw * 0.44
    leg_end_y = top_y + rh
    draw.line([(leg_start_x, leg_start_y), (leg_end_x, leg_end_y)], fill=(255, 255, 255), width=stroke)
    
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img

if __name__ == '__main__':
    # 512x512
    icon_512 = render_option2(512, bg_mode='white')
    icon_512.save('public/icons/icon-512.png', 'PNG')
    
    # 192x192
    icon_192 = render_option2(192, bg_mode='white')
    icon_192.save('public/icons/icon-192.png', 'PNG')
    
    # Favicon / ICO
    icon_256 = render_option2(256, bg_mode='white')
    icon_256.save('public/favicon.ico', format='ICO', sizes=[(16,16), (32,32), (64,64), (256,256)])
    icon_256.save('electron/build/icon.ico', format='ICO', sizes=[(16,16), (32,32), (64,64), (256,256)])
    print('Option 2 applied to all icon files!')
