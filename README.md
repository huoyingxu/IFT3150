# Graph Creater

打开 index.html，或访问本地预览 http://127.0.0.1:8766/ 。

## 操作

- 点击“＋ Circle”添加独立圆；点击“＋ 相切圆组”添加相切构造。
- 在相切圆组的来源菜单中选择父圆或圆组。来源为圆组时，对其中每个圆继续构造。
- 修改参数会更新该节点及下游图形。来源不能是自己或自己的下游。
- 卡片可以拖动标题栏移动，也可以折叠和删除。来源关系用自动连接线表示，箭头指向下游卡片；没有端口操作或选中高亮。
- “显示图形”只影响可见性，不影响下游计算；“显示轴”默认关闭。
- “适应画板”调整视野；输入错误会显示在卡片底部。
- 当前没有保存功能，刷新会恢复初始两个节点。第 8 步仍跳过。

## 文件职责

- point.js、node-axis.js、node-circle.js、self-tangent-circles.js：创建几何数据。
- graph-model.js：保存节点参数与来源，按依赖顺序计算图形。
- node-editor.js：卡片拖动、输入框、来源菜单、折叠和删除。
- graph-preview.js：显示几何结果和适应画板。
- renderer.js：将圆和轴绘制为 SVG。
- app.js：初始化，并连接参数修改与重新绘图。
- index.html、style.css：页面结构和样式。

更新流程：修改参数或来源 → evaluateGraph → 绘制图形 → 更新卡片状态。

拖动仅修改卡片 position，不修改圆心坐标；位置在当前页面会话中保留，刷新会重置。

## 间隙相切小圆

点击“＋ 间隙相切小圆”，选择已有等大内圆的相切圆组。
外圆 nRosy=N 时有 N 处间隙，每处生成两个相切小圆，共 2N 个（N≥2）。
例如 N=3 → 6 个，N=4 → 8 个，N=5 → 10 个。
用于相切的线是相邻内圆方向的角平分线，方向为外圆 rotation+(i+0.5)*360/N。
偶数 N 时这条线不一定属于原有外圆轴线，但仍是间隙的对称轴。
本卡片的 nRosy 和 rotation 只控制新圆自己的轴，不改变生成数量。
全部计算与检查通过才返回整组，任何错误都不会保留部分结果。
核心函数 createGapTangentCircles 位于 gap-tangent-circles.js。

## create circle by 3 parameter

Click **+ create circle by 3 parameter**. Choose three individual boundary circles using the A, B and C menus, or select a letter and click a circumference on the canvas. Circle numbers start at 1; you can choose separate circles from the same group.

- **External**: the new circle is outside and tangent to the boundary circle.
- **Internal (inside)**: the new circle is inside and tangent to the boundary circle.
- **Containing circle (optional)**: constrain the result to a selected outer circle.
- Valid candidates appear as dashed green circles. Click a candidate or its button to confirm; the result becomes solid green.
- Use **Edit boundaries / solution** on the node to adjust it. The result can be used as the source of another tangent group.

**Containment and collision checks** records all existing, valid source nodes that would not cause a cycle, including hidden geometry. Circles enclosing all three boundaries act as containers; other circles act as obstacles. Use **Refresh collision sources** after adding geometry. Downstream nodes cannot constrain their own source.

Changes in position, size or rotation recalculate the selected solution branch. If that branch disappears or becomes blocked, an error is shown instead of switching to another solution. If a source group's circle count changes, the same member indices are reevaluated; only missing members require reselection. Duplicate or degenerate constraints show an error. Solutions too small to distinguish reliably are omitted.

To reproduce the upper-left gap in the example: add Gap circles, then add **create circle by 3 parameter**. Select Gap group circles 1 and 2 for A and B, and Tangent circle 1 for C. Use External for all three, then confirm the candidate. Other boundary combinations and nRosy values are supported.

`three-tangent-circle.js` contains the solver and collision checks; `tangent-tool.js` contains selection and candidate previews; `graph-model.js` records dependencies. Run `node check-three-tangent.mjs` to verify tangency and dependency updates.

## Arc display editing

Enable **Edit arcs**, then click a segment: **solid → dashed → hidden**. Circles are split at intersections and tangencies with other circles. With fewer than two split points, the entire circumference is treated as one segment. Axis lines are not split or edited.

Enable **Show hidden arcs** to display faded guides. In editing mode, click a faded arc to restore it to solid. **Undo** reverses edits. **Restore all to solid** restores every segment and can also be undone. Use Tab to focus an arc, then Enter or Space to activate it.

Display settings do not affect geometry, collision checks or downstream dependencies. Opening the three-boundary construction tool exits arc editing and allows selection along complete circumferences. Existing arc styles are preserved.

Segments are identified by their source and endpoint contact relationships. Styles survive translation, rotation and scaling while those relationships remain unchanged. When segmentation changes, settings that no longer match are cleared with a notice. Hiding an entire node does not change segmentation. Coincident circumferences are drawn once so duplicates cannot cover hidden segments.

`arc-geometry.js` handles splitting and segment identities; `arc-styles.js` handles display states and undo. Run `node check-arc-styles.mjs` to verify.

Like the existing construction, all edits are held only in the current page. Refreshing resets the nodes and arc styles.

## Create arc

Click **+ Create arc** to add an independent arc node. Configure it in the node card:

1. **Support circle**: choose a specific existing circle, or **Define center and radius**. A defined radius can be a number, the distance from the center to a reference point, or another circle's radius multiplied by a positive factor.
2. **Endpoints**: choose **Angles**, **Directions toward reference points**, or **Exact points on the circle**. Directions project reference points onto the support circle; exact endpoints must already lie on it. Angle inputs are in degrees, counterclockwise from +X, and can follow the source circle's axis rotation.
3. **Arc portion**: select Short arc, Long arc, Counterclockwise, Clockwise or Full circle. For a semicircle, Short chooses CCW and Long chooses CW. Coincident endpoints require Full circle; that mode ignores the end input.

Point references support coordinates, a selected circle's center, a point on a circle (angle offset from its axis rotation), and the left/right intersection of two circles. Intersection identity is relative to the directed line between the first and second centers. A tangency provides a single shared point. Missing intersections, invalid endpoint positions and changed source-group counts produce errors instead of silently substituting another point.

To reproduce the red reference arc from the default three inner circles:

- Add an arc; choose Define center and radius.
- Center source: Circle center; Center circle: Circle group 2 / Circle 2.
- Radius source: Distance to a reference point; Radius point source: Circle center; circle: Circle group 2 / Circle 1.
- Endpoint mode: Exact points on the circle.
- Start source: Circle center; circle: Circle group 2 / Circle 1.
- End source: Circle center; circle: Circle group 2 / Circle 3.
- Arc portion: Short arc. This produces the clockwise 60-degree red arc.

This is a general center/radius/endpoint construction; it is not tied to three circles. For layouts where the two reference points have unequal distances from the center, choose Directions if projection is intended, or provide exact endpoints that satisfy the selected radius.

The output is an arc, not a complete circle. It is excluded from circle-only constructions and collision-source menus. Source references participate in graph updates and dependency checks. **Show construction guide** displays its support circle, center O, start S, end E and radial lines. **Fit view** includes the actual arc extent, or the whole guide when enabled.

Use **Edit arcs** to change the constructed arc as one piece between solid, dashed and hidden; undo and restore also apply. A visible source circle remains a separate object, so hide that source node to display only the arc. Changes to the arc's parameters preserve its display style. Refreshing still resets the page, as with the other nodes.

`constructed-arc.js` contains point resolution, dependency references, arc evaluation and bounds. `arc-node-editor.js` provides the construction controls. Run `node check-constructed-arc.mjs`, `node check-three-tangent.mjs` and `node check-arc-styles.mjs` for the geometry and rendering checks.

## Geometry and function graph

The editor presents two distinct card roles. Green **Geometry** cards own circle coordinates, radius, member-axis settings and visibility. Generated coordinates and radii are read-only; expand a circle group's member list to inspect indexed members. Amber **Function** cards own construction inputs: Self tangent takes a circle or group; Gap circles takes an equal self-tangent group and inherits its outer boundary; create circle by 3 parameter takes three indexed circles, tangency modes and a solution; Create arc takes support and endpoint definitions.

Each function has one separately displayed output geometry card. All source menus refer to geometry outputs. The evaluator keeps a single construction record for each function/output pair, preserving existing dependency identities, obstacle checks and arc styling. The two cards have independent positions and collapse states; deleting either removes the pair. Downstream functions report missing inputs rather than substituting another source.

Links follow Geometry → Function → Geometry, including the inherited outer boundary of Gap circles. Use **Auto arrange**, **Fit graph**, and the zoom buttons to navigate. Drag headers to position cards. Geometry visibility does not disable calculations. Generated circle axes remain editable on the geometry output and feed downstream functions.

Three-parameter boundaries continue to reference the same member numbers when the source group count changes. A missing member or invalid selected solution reports an error. Arc point references still validate their original group count.

## Automatic connection routing

ELK.js 0.12.0 is bundled locally in `vendor/elkjs`, including its EPL-2.0 license. It is sourced from the official npm package `elkjs@0.12.0`; no CDN connection is needed. Layout runs in a Web Worker.

**Auto arrange** computes left-to-right node positions and orthogonal routes using the actual card dimensions. Dedicated input ports distinguish Boundary A/B/C, inner group, outer circle, and active arc references, even when several inputs use the same geometry. Connections have labels identifying their purpose and selected member index. Collapsed cards retain their input ports.

Dragging, changing inputs, or resizing cards preserves manual positions and displays provisional dashed graph connections. Click Auto arrange to optimize them again. These dashed graph connections are unrelated to the arc display styles in the Result canvas. Zooming preserves the routed layout. An obsolete asynchronous layout result is discarded if the graph changed while it was being calculated. If automatic layout fails, manual positioning remains usable.

Run `node check-graph-layout.mjs` to check actual ELK routes, port endpoints, card avoidance, labels and missing references.

## Generate group from an arc

Click **Generate group** on a single arc's green Geometry card. This adds a Generate group function and an Arc group geometry output. The default is three members, including the original at 0 degrees and copies at 120 and 240 degrees. The center defaults to an ancestor independent circle's center, or another independent circle if available; without one, coordinates (0, 0) are used. Verify or change the center in the function card.

Choose a center circle or explicit coordinates. Set **Arc count** (1–60), or use **Follow center circle nRosy**. The source arc remains the live dependency. Its drawing is hidden on creation to avoid overlapping the group's first member; toggle Show geometry to display it again. Each group member has independent solid/dashed/hidden styling. Rotation preserves the source radius, sweep and endpoint geometry; three copies form the reference closed outline only when the source arc has the corresponding geometry. Deleting the group does not delete the source arc; re-enable its Show geometry if needed.

Run `node check-arc-group.mjs` for the closed three-arc reference and rotation/dependency checks.
