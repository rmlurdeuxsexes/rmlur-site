"""Builds the /lab/floppy cabinet kit in Blender (headless) and bakes textures.

  python -m venv env && env/bin/pip install bpy numpy pillow
  env/bin/python scripts/blender/build_cabinet.py [--out assets/cabinet] [--res 2048] [--render ref.png] [--no-bake]

Objects exported to assets/cabinet/cabinet.glb (names are used by lab/floppy/cabinet.js):
  Cabinet       shell: lid, sides, base, back, shelf, dividers, fixed slide rails
  Drawer        face + bin (origin = face centre, front plane at +1.5 cm), slides on z
  Drawer_Window clear plastic cover over the label window
  Drawer_Label  paper quad (UV 0..1) — the page swaps in a canvas texture
  Disk, Disk_Label, Divider, Key
Units: 1 Blender unit = 1 cm. Blender (x, y, z) == three.js (x, -z, y)  (front faces -Y).
"""
import bpy, bmesh, math, sys, os, argparse
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--out', default='assets/cabinet')
ap.add_argument('--res', type=int, default=2048)
ap.add_argument('--render', default='')
ap.add_argument('--no-bake', action='store_true')
args = ap.parse_args(argv)
os.makedirs(args.out, exist_ok=True)

COLS, ROWS, CELL_W, CELL_H, DEPTH = 3, 2, 22.0, 18.0, 36.0
CAB_W, CAB_H = COLS * CELL_W + 2, ROWS * CELL_H + 2
FACE_W, FACE_H, FACE_D = CELL_W - 0.8, CELL_H - 0.8, 3.0

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def T(x, y, z):            # three.js coords -> blender
    return Vector((x, -z, y))

def apply_mods(obj):
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

def box(name, w, h, d, c=(0, 0, 0), bevel=0.0, seg=3):
    """box of three.js size w(x) h(y) d(z) centred at three.js c."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=T(*c))
    o = bpy.context.active_object; o.name = name
    o.scale = (w, d, h); bpy.ops.object.transform_apply(scale=True)
    if bevel:
        m = o.modifiers.new('bev', 'BEVEL'); m.width = bevel; m.segments = seg; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(30)
        apply_mods(o)
    return o

def boolean(target, cutter, op='DIFFERENCE', delete=True):
    m = target.modifiers.new('b', 'BOOLEAN'); m.operation = op; m.object = cutter; m.solver = 'EXACT'
    apply_mods(target)
    if delete: bpy.data.objects.remove(cutter, do_unlink=True)

def join(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); o = bpy.context.active_object; o.name = name; return o

def assign(o, mat):
    o.data.materials.clear(); o.data.materials.append(mat)

def cyl(name, r, depth, c, axis='z', seg=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=depth, location=T(*c))
    o = bpy.context.active_object; o.name = name
    if axis == 'z': o.rotation_euler = (math.radians(90), 0, 0)    # three z axis == blender -y
    bpy.ops.object.transform_apply(rotation=True); return o

# ------------------------------------------------------------------ materials
def new_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m

def abs_material(name, tint=(0.80, 0.755, 0.64), seed=0.0):
    """procedural cream ABS: yellowing, edge wear, crevice dust, scuffs, fine grain."""
    m = new_mat(name); nt = m.node_tree; nt.nodes.clear()
    N = lambda t, **k: nt.nodes.new(t)
    out = N('ShaderNodeOutputMaterial'); bsdf = N('ShaderNodeBsdfPrincipled')
    texco = N('ShaderNodeTexCoord'); mapn = N('ShaderNodeMapping'); mapn.inputs['Location'].default_value = (seed, seed * 2, seed * 3)
    nt.links.new(texco.outputs['Object'], mapn.inputs['Vector'])
    big = N('ShaderNodeTexNoise'); big.inputs['Scale'].default_value = 0.06; big.inputs['Detail'].default_value = 6
    nt.links.new(mapn.outputs['Vector'], big.inputs['Vector'])
    fine = N('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value = 90; fine.inputs['Detail'].default_value = 3
    nt.links.new(mapn.outputs['Vector'], fine.inputs['Vector'])
    scuff = N('ShaderNodeTexNoise'); scuff.inputs['Scale'].default_value = 1.4; scuff.inputs['Detail'].default_value = 8
    scuff_mapn = N('ShaderNodeMapping'); scuff_mapn.inputs['Scale'].default_value = (1, 12, 1)   # streaky
    nt.links.new(texco.outputs['Object'], scuff_mapn.inputs['Vector']); nt.links.new(scuff_mapn.outputs['Vector'], scuff.inputs['Vector'])
    scuff_ramp = N('ShaderNodeMapRange'); scuff_ramp.inputs['From Min'].default_value = 0.62; scuff_ramp.inputs['From Max'].default_value = 0.70
    nt.links.new(scuff.outputs['Fac'], scuff_ramp.inputs['Value'])
    # edge wear: AO node inside=True lights convex edges
    edge = N('ShaderNodeAmbientOcclusion'); edge.inside = True; edge.inputs['Distance'].default_value = 0.35; edge.samples = 16
    edge_r = N('ShaderNodeMapRange'); edge_r.inputs['From Min'].default_value = 0.55; edge_r.inputs['From Max'].default_value = 1.0
    nt.links.new(edge.outputs['AO'], edge_r.inputs['Value'])
    # crevice dust: ordinary AO
    dust = N('ShaderNodeAmbientOcclusion'); dust.inputs['Distance'].default_value = 3.0; dust.samples = 24
    dust_r = N('ShaderNodeMapRange'); dust_r.inputs['From Min'].default_value = 0.35; dust_r.inputs['From Max'].default_value = 1.0
    nt.links.new(dust.outputs['AO'], dust_r.inputs['Value'])
    # colour mix
    base = N('ShaderNodeRGB'); base.outputs[0].default_value = (*tint, 1)
    yellow = N('ShaderNodeRGB'); yellow.outputs[0].default_value = (0.74, 0.64, 0.42, 1)
    mix1 = N('ShaderNodeMixRGB'); nt.links.new(big.outputs['Fac'], mix1.inputs['Fac']); mix1.inputs['Fac'].default_value = 0.0
    nt.links.new(big.outputs['Fac'], mix1.inputs[0]); nt.links.new(base.outputs[0], mix1.inputs[1]); nt.links.new(yellow.outputs[0], mix1.inputs[2])
    grain = N('ShaderNodeMixRGB'); grain.blend_type = 'MULTIPLY'; grain.inputs[0].default_value = 0.18
    nt.links.new(mix1.outputs[0], grain.inputs[1]); nt.links.new(fine.outputs['Color'], grain.inputs[2])
    wear = N('ShaderNodeMixRGB'); wear.inputs[2].default_value = (0.93, 0.91, 0.84, 1)
    nt.links.new(edge_r.outputs[0], wear.inputs[0]); nt.links.new(grain.outputs[0], wear.inputs[1])
    dirt = N('ShaderNodeMixRGB'); dirt.inputs[2].default_value = (0.36, 0.30, 0.20, 1)
    inv = N('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    nt.links.new(dust_r.outputs[0], inv.inputs[1]); mulf = N('ShaderNodeMath'); mulf.operation = 'MULTIPLY'; mulf.inputs[1].default_value = 0.55
    nt.links.new(inv.outputs[0], mulf.inputs[0])
    nt.links.new(mulf.outputs[0], dirt.inputs[0]); nt.links.new(wear.outputs[0], dirt.inputs[1])
    scf = N('ShaderNodeMixRGB'); scf.inputs[2].default_value = (0.55, 0.50, 0.40, 1)
    sm = N('ShaderNodeMath'); sm.operation = 'MULTIPLY'; sm.inputs[1].default_value = 0.35
    nt.links.new(scuff_ramp.outputs[0], sm.inputs[0]); nt.links.new(sm.outputs[0], scf.inputs[0]); nt.links.new(dirt.outputs[0], scf.inputs[1])
    nt.links.new(scf.outputs[0], bsdf.inputs['Base Color'])
    # roughness: satin plastic, rougher in dust, glossier where handled (edges)
    rough = N('ShaderNodeMapRange'); rough.inputs['To Min'].default_value = 0.62; rough.inputs['To Max'].default_value = 0.42
    nt.links.new(edge_r.outputs[0], rough.inputs['Value'])
    rj = N('ShaderNodeMath'); rj.operation = 'ADD'; nt.links.new(rough.outputs[0], rj.inputs[0])
    gj = N('ShaderNodeMath'); gj.operation = 'MULTIPLY'; gj.inputs[1].default_value = 0.12
    nt.links.new(fine.outputs['Fac'], gj.inputs[0]); nt.links.new(gj.outputs[0], rj.inputs[1])
    nt.links.new(rj.outputs[0], bsdf.inputs['Roughness'])
    # micro surface (baked into the normal map)
    bump = N('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.25; bump.inputs['Distance'].default_value = 0.02
    nt.links.new(fine.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    return m

def flat_mat(name, color, rough=0.5, metal=0.0, **extra):
    m = new_mat(name); b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    for k, v in extra.items(): b.inputs[k.replace('_', ' ')].default_value = v
    return m

M_ABS = abs_material('ABS_cream', seed=1.7)
M_ABS_DISK = abs_material('ABS_disk', tint=(0.62, 0.62, 0.62), seed=5.1)   # grey: page tints per genre
M_RED = flat_mat('RedSteel', (0.42, 0.035, 0.045), 0.32, 0.45)
M_STEEL = flat_mat('Steel', (0.72, 0.74, 0.77), 0.28, 1.0)
M_CLEAR = flat_mat('ClearPlastic', (0.88, 0.92, 0.98), 0.08, 0.0, Transmission_Weight=0.9, Alpha=0.35, IOR=1.49)
M_PAPER = flat_mat('LabelPaper', (0.9, 0.88, 0.8), 0.85)
M_DIV = flat_mat('DividerGrey', (0.11, 0.11, 0.115), 0.55)
M_KEY = flat_mat('KeyPlastic', (0.88, 0.87, 0.83), 0.4)
M_DARK = flat_mat('SlotShadow', (0.02, 0.02, 0.02), 1.0)

# ------------------------------------------------------------------ cabinet shell
parts = []
parts.append(box('lid', CAB_W + 1.2, 1.4, DEPTH + 1.5, (0, CAB_H + 0.7, 0.4), 0.28))
parts.append(box('base', CAB_W, 1.2, DEPTH, (0, 0.6, 0), 0.22))
parts.append(box('sideL', 1.2, CAB_H, DEPTH, (-CAB_W / 2 + 0.6, CAB_H / 2, 0), 0.2))
parts.append(box('sideR', 1.2, CAB_H, DEPTH, (CAB_W / 2 - 0.6, CAB_H / 2, 0), 0.2))
parts.append(box('back', CAB_W, CAB_H, 1.0, (0, CAB_H / 2, -DEPTH / 2 + 0.5), 0.1))
parts.append(box('shelf', CAB_W, 1.0, DEPTH, (0, 1 + CELL_H, 0), 0.18))
for i, x in enumerate((-CELL_W / 2, CELL_W / 2)):
    parts.append(box(f'div{i}', 0.8, CAB_H, DEPTH - 2, (x, CAB_H / 2, -1), 0.16))
cabinet = join('Cabinet', parts)
assign(cabinet, M_ABS)
rails = []
for r in range(ROWS):
    for c in range(COLS):
        cx, cy = (c - 1) * CELL_W, 1.2 + r * CELL_H + 6.6 + 2
        for s in (-1, 1):
            rails.append(box('rail', 0.35, 0.35, DEPTH - 6, (cx + s * 10.0, cy, -2), 0.06, 2))
rails = join('CabinetRails', rails); assign(rails, M_STEEL)
bpy.ops.object.select_all(action='DESELECT'); cabinet.select_set(True); rails.select_set(True)
bpy.context.view_layer.objects.active = cabinet
bpy.ops.object.join()                         # one mesh, two material slots
cabinet = bpy.context.active_object; cabinet.name = 'Cabinet'
cabinet.data.materials.clear(); cabinet.data.materials.append(M_ABS); cabinet.data.materials.append(M_STEEL)
# rail faces already carry slot index 1 only if the join preserved per-object material indexes
for p in cabinet.data.polygons: p.material_index = 0
# re-tag rails: thin faces near rail locations are tiny; tag by vertex proximity instead
rail_zones = [(((c - 1) * CELL_W + s * 10.0), 1.2 + r * CELL_H + 8.6) for r in range(ROWS) for c in range(COLS) for s in (-1, 1)]
for p in cabinet.data.polygons:
    co = cabinet.matrix_world @ p.center           # blender; three.x = co.x, three.y = co.z
    for (zx, zy) in rail_zones:
        if abs(co.x - zx) < 0.4 and abs(co.z - zy) < 0.4 and -DEPTH / 2 + 3 < -co.y < DEPTH / 2 - 3:
            p.material_index = 1; break

# ------------------------------------------------------------------ drawer
def build_drawer():
    FW, FH = FACE_W, FACE_H
    face = box('face', FW, FH, FACE_D, (0, 0, 0), 0.9, 5)
    # label window recess
    wx, wy = -4.0, 4.7
    cut = box('cut', 13.2, 4.4, 1.6, (wx, wy, FACE_D / 2 - 0.3 + 0.0))
    boolean(face, cut)
    frame_parts = []
    # frame lip standing in the recess
    lip = box('lip', 13.6, 4.8, 0.3, (wx, wy, FACE_D / 2 - 0.15), 0.05, 2)
    # lock plate (raised) with keyhole
    lx, ly = 7.4, 4.7
    plate = box('plate', 4.4, 4.4, 0.7, (lx, ly, FACE_D / 2 + 0.2), 0.18)
    hole = cyl('hole', 0.45, 3, (lx, ly, FACE_D / 2 + 0.3))
    boolean(plate, hole)
    # finger slot: scooped recess in the lower half
    slot = box('slot', 14, 4.4, 2.2, (0, -5.0, FACE_D / 2 - 0.1), 0.35, 3)
    boolean(face, slot)
    rim = box('rim', 14.8, 0.45, 0.55, (0, -2.65, FACE_D / 2 + 0.05), 0.12, 2)
    # molded maker's mark: shallow plate
    mark = box('mark', 3.4, 0.7, 0.1, (5.6, -0.6, FACE_D / 2 + 0.03), 0.02, 1)
    fa = join('Drawer', [face, lip, plate, rim, mark])
    # bin
    L, W, H = 28.0, 19.6, 13.0
    zc = -L / 2 - FACE_D / 2
    bin_parts = [box('floor', W, 0.6, L, (0, -H / 2, zc), 0.1),
                 box('wallL', 0.6, H, L, (-W / 2, 0, zc), 0.1), box('wallR', 0.6, H, L, (W / 2, 0, zc), 0.1),
                 box('backw', W, H, 0.6, (0, 0, -L - FACE_D / 2), 0.1)]
    for i in range(7):
        bin_parts.append(box('rib', 0.3, 0.3, L - 4, (-9 + i * 3, -H / 2 + 0.45, zc), 0.05, 1))
    bin_o = join('bin', bin_parts)
    drawer = join('Drawer', [fa, bin_o])
    assign(drawer, M_ABS)
    # red slides (own material slot via separate object joined after)
    rl = []
    for s in (-1, 1):
        for dy in (H / 2 - 0.4, H / 2 - 1.2):
            rl.append(box('slide', 0.5, 0.5, L + 3, (s * (W / 2 + 0.55), dy, zc + 1.5), 0.12, 2))
    slides = join('slides', rl); assign(slides, M_RED)
    n_abs = len(drawer.data.polygons)
    bpy.ops.object.select_all(action='DESELECT'); drawer.select_set(True); slides.select_set(True)
    bpy.context.view_layer.objects.active = drawer; bpy.ops.object.join()
    drawer = bpy.context.active_object; drawer.name = 'Drawer'
    drawer.data.materials.clear(); drawer.data.materials.append(M_ABS); drawer.data.materials.append(M_RED)
    for i, p in enumerate(drawer.data.polygons): p.material_index = 0 if i < n_abs else 1
    return drawer

drawer = build_drawer()
drawer.location = T(0, 60, 0)    # build zone away from the cabinet; exporter keeps local origin at face centre
window = box('Drawer_Window', 13.0, 4.2, 0.5, (-4.0, 4.7, FACE_D / 2 + 0.05), 0.12, 2); assign(window, M_CLEAR)
label = None
bpy.ops.mesh.primitive_plane_add(size=1, location=T(-4.0, 4.7, FACE_D / 2 - 0.12))
label = bpy.context.active_object; label.name = 'Drawer_Label'; label.scale = (12.6, 3.9, 1); label.rotation_euler = (math.radians(90), 0, 0)
bpy.ops.object.transform_apply(scale=True, rotation=True); assign(label, M_PAPER)
# keep window/label at their local positions; drawer body stays at origin for the export
drawer.location = (0, 0, 0)

# ------------------------------------------------------------------ disk
def build_disk():
    w, h, d = 9.0, 9.4, 0.32
    shell = box('shell', w, h, d, (0, 0, 0), 0.07, 2)
    # chamfer top-right corner
    bm = bmesh.new(); bm.from_mesh(shell.data)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=T(w / 2 - 0.5, h / 2, 0), plane_no=Vector((1, 0, 1)).normalized() if False else Vector((0.7071, 0, 0.7071)), clear_outer=True)
    bm.to_mesh(shell.data); bm.free()
    well = box('well', 7.4, 4.8, 0.2, (0, -2.3, d / 2), 0)
    boolean(shell, well)
    slotc = box('wp', 0.7, 0.6, 1, (-w / 2 + 1.0, -h / 2 + 0.9, 0))
    boolean(shell, slotc)
    sh = box('shutter', 4.9, 3.3, 0.38, (0.4, 3.0, 0), 0.06, 2)
    shwin = box('shwin', 1.5, 2.3, 1, (1.3, 3.0, 0)); boolean(sh, shwin)
    assign(shell, M_ABS_DISK); assign(sh, M_STEEL)
    disk = join('Disk', [shell, sh])
    disk.data.materials.clear(); disk.data.materials.append(M_ABS_DISK); disk.data.materials.append(M_STEEL)
    nshell = sum(1 for _ in disk.data.polygons)
    return disk
disk = build_disk()
# material index: shutter faces = those near the shutter box
for p in disk.data.polygons:
    c = p.center
    p.material_index = 1 if (abs(c.x - 0.4) < 2.6 and abs(c.z - 3.0) < 1.8 and abs(c.y) < 0.25) else 0
bpy.ops.mesh.primitive_plane_add(size=1, location=T(0, -2.3, 0.115))
dl = bpy.context.active_object; dl.name = 'Disk_Label'; dl.scale = (7.2, 4.6, 1); dl.rotation_euler = (math.radians(90), 0, 0)
bpy.ops.object.transform_apply(scale=True, rotation=True); assign(dl, M_PAPER)

# ------------------------------------------------------------------ divider + key
dv = box('Divider', 18, 8, 0.5, (0, 0, 0), 0.08, 2)
hc = box('handle', 7, 2.4, 2, (0, 1.8, 0)); boolean(dv, hc); assign(dv, M_DIV)
tab = box('tab', 5, 1.2, 0.5, (-5, 4.6, 0), 0.06, 2); assign(tab, M_DIV)
dv = join('Divider', [dv, tab])
bm = bmesh.new()
pts = [(0, 2.6), (2.6, 0), (0, -2.6), (-2.6, 0)]
verts = [bm.verts.new(T(x, y, 0)) for x, y in pts]
f = bm.faces.new(verts)
ext = bmesh.ops.extrude_face_region(bm, geom=[f]); ev = [v for v in ext['geom'] if isinstance(v, bmesh.types.BMVert)]
bmesh.ops.translate(bm, vec=Vector((0, -0.35, 0)), verts=ev)
mesh = bpy.data.meshes.new('Key'); bm.to_mesh(mesh); bm.free()
key = bpy.data.objects.new('Key', mesh); bpy.context.collection.objects.link(key)
bpy.context.view_layer.objects.active = key; key.select_set(True)
m = key.modifiers.new('bev', 'BEVEL'); m.width = 0.18; m.segments = 3; apply_mods(key)
kh = cyl('kh', 0.5, 2, (0, -1.2, 0)); boolean(key, kh)
stem = cyl('stem', 0.28, 2.6, (0, 1.0, -1.4)); stem.rotation_euler = (0, 0, 0)
stem.rotation_euler = (math.radians(90) * 0, 0, 0)
key = join('Key', [key, stem]); assign(key, M_KEY)

# smooth-shade everything and unwrap
def finish(o, margin=0.012):
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    for p in o.data.polygons: p.use_smooth = True
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin, correct_aspect=True)
    bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)
for o in (cabinet, drawer, disk, dv, key): finish(o)
for o in (window, label, dl):
    bpy.context.view_layer.objects.active = o
    o.select_set(True); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.unwrap(); bpy.ops.object.mode_set(mode='OBJECT'); o.select_set(False)
window.name = 'Drawer_Window'; label.name = 'Drawer_Label'; dl.name = 'Disk_Label'

print('OBJECTS', [(o.name, len(o.data.polygons)) for o in bpy.data.objects if o.type == 'MESH'])

# ------------------------------------------------------------------ showcase render (visual check only)
def showcase(path, open_idx=1, res=(1280, 800), samples=48):
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = False
    w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    # ground
    bpy.ops.mesh.primitive_plane_add(size=600, location=(0, 0, 0)); g = bpy.context.active_object
    gm = flat_mat('ground', (1, 1, 1), 0.9); assign(g, gm)
    # place drawers in cells
    for idx in range(6):
        r, c = divmod(idx, 3)
        cx, cy = (c - 1) * CELL_W, 1.2 + (ROWS - 1 - r) * CELL_H + CELL_H / 2 - 0.4
        z = DEPTH / 2 - FACE_D / 2 + (26 if idx == open_idx else 0)
        d = drawer.copy(); d.data = drawer.data; bpy.context.collection.objects.link(d); d.location = T(cx, cy, z)
        for src in (window, label):
            o = src.copy(); o.data = src.data; bpy.context.collection.objects.link(o); o.location = T(cx, cy, z)
        if idx == open_idx:
            for i in range(6):
                k = disk.copy(); k.data = disk.data; bpy.context.collection.objects.link(k)
                k.location = T(cx + (4.9 if i % 2 else -4.9), cy - 2.7, z - FACE_D / 2 - 25 + (i // 2) * 1.5); k.rotation_euler = (math.radians(90 - 35.5), 0, 0)
                kl = dl.copy(); kl.data = dl.data; bpy.context.collection.objects.link(kl); kl.parent = k; kl.location = (0, 0, 0)
                kl.matrix_parent_inverse = k.matrix_world.inverted() if False else kl.matrix_parent_inverse
    for o in (window, label, disk, dl, drawer, dv, key): o.hide_render = True
    # lights: big soft key upper-left, weak fill
    ld = bpy.data.lights.new('key', 'AREA'); ld.energy = 25000; ld.size = 120; ko = bpy.data.objects.new('key', ld); bpy.context.collection.objects.link(ko)
    ko.location = T(-70, 110, 90); ko.rotation_euler = (math.radians(55), 0, math.radians(-35))
    ld2 = bpy.data.lights.new('fill', 'AREA'); ld2.energy = 6000; ld2.size = 150; fo = bpy.data.objects.new('fill', ld2); bpy.context.collection.objects.link(fo)
    fo.location = T(90, 40, 80); fo.rotation_euler = (math.radians(75), 0, math.radians(45))
    cam = bpy.data.cameras.new('cam'); cam.lens = 85; cam.sensor_width = 36
    co = bpy.data.objects.new('cam', cam); bpy.context.collection.objects.link(co); scene.camera = co
    co.location = T(0, 112, 104)
    tgt = T(0, 16, 26); co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = path; bpy.ops.render.render(write_still=True)

if args.render:
    showcase(args.render)
    sys.exit(0)

# ------------------------------------------------------------------ bake + export (runs when --render is not given)
import numpy as np
from PIL import Image

def bake_object(o, res, tag):
    """bake albedo / roughness / normal of o's procedural slot-0 material into PNGs; returns paths."""
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 24; scene.cycles.use_denoising = False
    paths = {}
    mats = [s.material for s in o.material_slots]
    orig = list(mats)
    imgs = {k: bpy.data.images.new(f'{tag}_{k}', res, res, alpha=False, float_buffer=(k == 'normal')) for k in ('albedo', 'rough', 'normal')}
    for kind, btype in (('albedo', 'DIFFUSE'), ('rough', 'ROUGHNESS'), ('normal', 'NORMAL')):
        for i, s in enumerate(o.material_slots):
            m = orig[i].copy(); s.material = m
            nt = m.node_tree; n = nt.nodes.new('ShaderNodeTexImage'); n.image = imgs[kind]; nt.nodes.active = n
        for p in o.data.polygons: pass
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bs = scene.render.bake; bs.margin = 10; bs.use_clear = True
        if btype == 'DIFFUSE': bs.use_pass_direct = False; bs.use_pass_indirect = False; bs.use_pass_color = True
        bpy.ops.object.bake(type=btype, margin=10, use_clear=True)
        for i, s in enumerate(o.material_slots): s.material = orig[i]
    for k, im in imgs.items():
        p = os.path.join(args.out, f'{tag}_{k}.png'); im.filepath_raw = p; im.file_format = 'PNG'; im.save(); paths[k] = p
    return paths

def make_baked_material(o, tag, paths, keep_slots=()):
    """swap slot-0 for a Principled material fed by the baked maps (exporter-friendly); keep other slots as is."""
    m = bpy.data.materials.new(f'{tag}_baked'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); b = nt.nodes.new('ShaderNodeBsdfPrincipled'); nt.links.new(b.outputs[0], out.inputs[0])
    def tex(path, cs):
        n = nt.nodes.new('ShaderNodeTexImage'); n.image = bpy.data.images.load(path); n.image.colorspace_settings.name = cs; return n
    a = tex(paths['albedo'], 'sRGB'); nt.links.new(a.outputs['Color'], b.inputs['Base Color'])
    r = tex(paths['rough'], 'Non-Color'); sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(r.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], b.inputs['Roughness'])
    nm = tex(paths['normal'], 'Non-Color'); nmap = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(nm.outputs['Color'], nmap.inputs['Color']); nt.links.new(nmap.outputs['Normal'], b.inputs['Normal'])
    b.inputs['Metallic'].default_value = 0.0
    o.material_slots[0].material = m
    return m

if not args.no_bake:
    R = args.res
    plan = [(cabinet, 'cabinet', R), (drawer, 'drawer', R), (disk, 'disk', max(512, R // 2)), (dv, 'divider', 512), (key, 'key', 512)]
    for o, tag, res in plan:
        print('BAKE', tag, res, flush=True)
        paths = bake_object(o, res, tag)
        make_baked_material(o, tag, paths)
    for o in (window, label, dl): pass
    for o in bpy.data.objects: o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=os.path.join(args.out, 'cabinet.glb'), export_format='GLB', use_selection=True,
                              export_image_format='JPEG', export_jpeg_quality=88, export_yup=True, export_apply=False,
                              export_materials='EXPORT', export_cameras=False, export_lights=False)
    print('EXPORTED', os.path.getsize(os.path.join(args.out, 'cabinet.glb')))
