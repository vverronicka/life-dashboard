const STORAGE_KEY = "life_dashboard_v1";
let state = loadState();

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  setupButtons();
  renderAll();
});

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); }
    catch { console.error("Ошибка данных, создаю заново"); }
  }

  const now = Date.now();
  return {
    spheres: [
      { id: "s1", name: "Похудение", order: 1 },
      { id: "s2", name: "Личная жизнь", order: 2 }
    ],
    tasks: [
      {
        id: "t1",
        sphereId: "s1",
        parentId: null,
        title: "Следим за питанием",
        status: "plan",
        block: "active",
        important: false,
        createdAt: now,
        completedAt: null,
        deletedAt: null
      }
    ]
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Навигация
function setupNav() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      document.getElementById(btn.dataset.view + "View").classList.add("active");

      renderAll();
    });
  });
}

// Кнопки действия
function setupButtons() {
  document.getElementById("addSphereBtn").addEventListener("click", () => {
    const name = prompt("Название сферы:");
    if (!name) return;

    const order = Math.max(0, ...state.spheres.map(s => s.order)) + 1;
    state.spheres.push({
      id: "s" + Date.now(),
      name: name.trim(),
      order
    });
    saveState();
    renderMain();
  });

  document.getElementById("printBtn").addEventListener("click", () => window.print());
  document.getElementById("exportBtn").addEventListener("click", exportData);

  const importInput = document.getElementById("importFileInput");
  document.getElementById("importBtn").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", handleImportFile);
}

// Экспорт
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `life-dashboard-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Импорт
function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.spheres || !data.tasks) {
        alert("Неверный файл.");
        return;
      }
      if (!confirm("Заменить текущие данные?")) return;

      state = data;
      saveState();
      renderAll();
      alert("Импортировано.");
    } catch {
      alert("Ошибка чтения файла");
    }
  };
  reader.readAsText(file, "utf-8");
}
function renderAll() {
  renderMain();
  renderArchive();
  renderTrash();
  renderReport();
}

/* ------ Главная ------ */

function renderMain() {
  const container = document.getElementById("mainView");
  container.innerHTML = "";

  const list = document.createElement("div");
  list.className = "sphere-list";

  [...state.spheres].sort((a,b)=>a.order-b.order).forEach(sphere => {
    list.appendChild(createSphereCard(sphere));
  });

  container.appendChild(list);
}

function createSphereCard(sphere) {
  const card = document.createElement("section");
  card.className = "sphere-card";
  card.dataset.sphereId = sphere.id;
  card.draggable = true;

  card.addEventListener("dragstart", onSphereDragStart);
  card.addEventListener("dragover", onSphereDragOver);
  card.addEventListener("drop", onSphereDrop);
  card.addEventListener("dragend", ()=> draggedSphereId=null);

  const header = document.createElement("div");
  header.className = "sphere-header";

  const drag = document.createElement("span");
  drag.textContent = "☰";
  drag.style.cursor = "grab";
  header.appendChild(drag);

  const title = document.createElement("span");
  title.className = "sphere-title";
  title.textContent = sphere.name;
  header.appendChild(title);

  const rename = document.createElement("button");
  rename.className = "icon-button";
  rename.textContent = "✏️";
  rename.onclick = () => {
    const n = prompt("Новое название:", sphere.name);
    if (n) {
      sphere.name = n.trim();
      saveState();
      renderMain();
    }
  };
  header.appendChild(rename);

  const del = document.createElement("button");
  del.className = "icon-button";
  del.textContent = "🗑";
  del.onclick = () => {
    if (!confirm("Удалить сферу со всеми задачами?")) return;
    state.tasks = state.tasks.filter(t => t.sphereId !== sphere.id);
    state.spheres = state.spheres.filter(s => s.id !== sphere.id);
    saveState();
    renderAll();
  };
  header.appendChild(del);

  card.appendChild(header);

  const body = document.createElement("div");
  body.className = "sphere-body";

  /* АКТУАЛЬНЫЕ */
  const t1 = document.createElement("div");
  t1.className = "section-title";
  t1.textContent = "Актуальные задачи";
  body.appendChild(t1);

  const addActive = document.createElement("button");
  addActive.className = "btn btn-ghost";
  addActive.textContent = "+ Задача";
  addActive.onclick = ()=>addTaskPrompt(sphere.id,"active");
  body.appendChild(addActive);

  const activeList = document.createElement("div");
  activeList.className = "task-list";
  activeList.dataset.sphereId = sphere.id;
  activeList.dataset.block = "active";
  activeList.addEventListener("dragover", onTaskDragOver);
  activeList.addEventListener("drop", onTaskDrop);

  state.tasks.filter(t =>
    t.sphereId===sphere.id && t.block==="active" && !t.parentId && !t.deletedAt
  ).forEach(t => activeList.appendChild(createTaskItem(t)));

  body.appendChild(activeList);

  /* ПЛАНИРОВАНИЕ */
  const planBox = document.createElement("div");
  planBox.className = "planning-box";

  const ph = document.createElement("div");
  ph.className = "planning-header";

  const pt = document.createElement("div");
  pt.className = "planning-title";
  pt.innerHTML = "Планирование <span class='planning-hint'>• перспективные задачи</span>";
  ph.appendChild(pt);

  const toggle = document.createElement("button");
  toggle.className = "icon-button";
  toggle.textContent = "▾";

  const addPlan = document.createElement("button");
  addPlan.className = "icon-button";
  addPlan.textContent = "＋";
  addPlan.onclick = ()=>addTaskPrompt(sphere.id,"planning");

  ph.appendChild(toggle);
  ph.appendChild(addPlan);
  planBox.appendChild(ph);

  const planList = document.createElement("div");
  planList.className = "task-list";
  planList.dataset.sphereId = sphere.id;
  planList.dataset.block = "planning";
  planList.addEventListener("dragover", onTaskDragOver);
  planList.addEventListener("drop", onTaskDrop);

  state.tasks.filter(t =>
    t.sphereId===sphere.id && t.block==="planning" && !t.parentId && !t.deletedAt
  ).forEach(t => planList.appendChild(createTaskItem(t)));

  planBox.appendChild(planList);

  toggle.onclick = () => {
    const hidden = planList.style.display === "none";
    planList.style.display = hidden ? "flex" : "none";
    toggle.textContent = hidden ? "▾" : "▸";
  };

  body.appendChild(planBox);

  card.appendChild(body);
  return card;
}

let draggedSphereId = null;
function onSphereDragStart(e){ draggedSphereId = e.currentTarget.dataset.sphereId; }
function onSphereDragOver(e){ e.preventDefault(); }
function onSphereDrop(e){
  e.preventDefault();
  const targetId = e.currentTarget.dataset.sphereId;
  if (!draggedSphereId || draggedSphereId===targetId) return;

  const a = state.spheres.find(s=>s.id===draggedSphereId);
  const b = state.spheres.find(s=>s.id===targetId);

  const tmp = a.order;
  a.order = b.order;
  b.order = tmp;

  saveState();
  renderMain();
}

/* ------ Задачи ------ */

let draggedTaskId = null;

function createTaskItem(task) {
  const item = document.createElement("div");
  item.className = "task-item";
  item.dataset.taskId = task.id;
  item.draggable = true;

  item.addEventListener("dragstart", e => { draggedTaskId = task.id; });
  item.addEventListener("dragend", () => draggedTaskId=null);

  const row = document.createElement("div");
  row.className = "task-header-row";

  const drag = document.createElement("span");
  drag.textContent = "⋮⋮";
  drag.className = "task-drag-handle";
  row.appendChild(drag);

  const title = document.createElement("span");
  title.className = "task-title";
  title.contentEditable = true;
  title.textContent = task.title;
  title.onblur = () => {
    task.title = title.textContent.trim();
    saveState();
  };
  row.appendChild(title);

  const imp = document.createElement("span");
  imp.className = "badge-important";
  imp.textContent = task.important ? "❗" : "❕";
  imp.onclick = () => {
    task.important = !task.important;
    imp.textContent = task.important ? "❗" : "❕";
    saveState();
  };
  row.appendChild(imp);

  item.appendChild(row);

  /* selects */
  const sr = document.createElement("div");
  sr.className = "task-selects-row";

  const st = document.createElement("select");
  [["plan","В планах"],["process","В процессе"],["done","Сделано"]]
    .forEach(([v,l])=>{
      const o=document.createElement("option");
      o.value=v; o.textContent=l;
      if(task.status===v) o.selected=true;
      st.appendChild(o);
    });

  st.onchange = ()=>{
    const prev=task.status;
    task.status = st.value;
    if(prev!=="done" && st.value==="done") task.completedAt = Date.now();
    if(prev==="done" && st.value!=="done") task.completedAt=null;
    saveState();
    renderReport();
  };
  sr.appendChild(st);

  const block = document.createElement("select");
  [["active","Актуальные"],["planning","Планирование"],["archive","Архив"]]
    .forEach(([v,l])=>{
      const o=document.createElement("option");
      o.value=v; o.textContent=l;
      if(task.block===v) o.selected=true;
      block.appendChild(o);
    });

  block.onchange = ()=>{
    task.block = block.value;
    saveState();
    renderAll();
  };

  sr.appendChild(block);
  item.appendChild(sr);

  /* subactions */
  const actions = document.createElement("div");
  actions.className = "task-subactions";

  const addSub = document.createElement("span");
  addSub.className="link-like";
  addSub.textContent="＋ подзадача";
  addSub.onclick = ()=>{
    const t = prompt("Подзадача:");
    if(!t) return;
    const now=Date.now();
    state.tasks.push({
      id:"t"+now,
      sphereId: task.sphereId,
      parentId: task.id,
      title: t.trim(),
      status: "plan",
      block: task.block,
      important: false,
      createdAt:now,
      completedAt:null,
      deletedAt:null
    });
    saveState();
    renderMain();
  };
  actions.appendChild(addSub);

  const arc = document.createElement("span");
  arc.className="link-like";
  arc.textContent="в архив";
  arc.onclick=()=>{
    task.block="archive";
    saveState();
    renderAll();
  };
  actions.appendChild(arc);

  const del = document.createElement("span");
  del.className="link-like";
  del.textContent="удалить";
  del.onclick=()=>{
    if(!confirm("Переместить в корзину?")) return;
    task.deletedAt = Date.now();
    saveState();
    renderAll();
  };
  actions.appendChild(del);

  item.appendChild(actions);

  /* SUBTASKS */
  const subs = state.tasks.filter(st=>st.parentId===task.id && !st.deletedAt);
  if (subs.length) {
    const box = document.createElement("div");
    box.className="subtasks";

    subs.forEach(st=>{
      const r=document.createElement("div");
      r.className="subtask-item";

      const sl=document.createElement("select");
      [["plan","…"],["process","▶"],["done","✓"]].forEach(([v,l])=>{
        const o=document.createElement("option");
        o.value=v; o.textContent=l;
        if(st.status===v) o.selected=true;
        sl.appendChild(o);
      });
      sl.onchange=()=>{
        const prev=st.status;
        st.status=sl.value;
        if(prev!=="done" && sl.value==="done") st.completedAt=Date.now();
        if(prev==="done" && sl.value!=="done") st.completedAt=null;
        saveState();
        renderReport();
      };
      r.appendChild(sl);

      const inp=document.createElement("input");
      inp.value=st.title;
      inp.onblur=()=>{
        st.title=inp.value.trim();
        saveState();
      };
      r.appendChild(inp);

      const x=document.createElement("span");
      x.className="link-like";
      x.textContent="×";
      x.onclick=()=>{
        if(!confirm("Удалить?")) return;
        st.deletedAt=Date.now();
        saveState();
        renderMain();
      };
      r.appendChild(x);

      box.appendChild(r);
    });

    item.appendChild(box);
  }

  return item;
}

function addTaskPrompt(sphereId, block) {
  const t = prompt("Текст задачи:");
  if (!t) return;

  const now=Date.now();
  state.tasks.push({
    id:"t"+now,
    sphereId,
    parentId:null,
    title:t.trim(),
    status:"plan",
    block,
    important:false,
    createdAt:now,
    completedAt:null,
    deletedAt:null
  });
  saveState();
  renderAll();
}

function onTaskDragOver(e){
  e.preventDefault();
  e.currentTarget.classList.add("drop-target");
}

function onTaskDrop(e){
  e.preventDefault();
  e.currentTarget.classList.remove("drop-target");

  if(!draggedTaskId) return;
  const task = state.tasks.find(t=>t.id===draggedTaskId);
  if(!task) return;

  task.sphereId = e.currentTarget.dataset.sphereId;
  task.block = e.currentTarget.dataset.block;
  task.parentId = null;

  saveState();
  renderAll();
}

/* ------ Архив ------ */

function renderArchive(){
  const c=document.getElementById("archiveView");
  c.innerHTML="<h2>Архив</h2>";

  const g={};
  state.tasks.forEach(t=>{
    if(t.block!=="archive" || t.deletedAt) return;
    const s=state.spheres.find(x=>x.id===t.sphereId);
    const n=s?s.name:"Без сферы";
    (g[n]=g[n]||[]).push(t);
  });

  if(!Object.keys(g).length){
    c.innerHTML+="<p>Пусто.</p>";
    return;
  }

  const list=document.createElement("div");
  list.className="simple-list";

  Object.keys(g).sort().forEach(n=>{
    const card=document.createElement("div");
    card.className="simple-card";

    const h=document.createElement("div");
    h.className="simple-card-header";
    h.textContent=n;
    card.appendChild(h);

    const ul=document.createElement("ul");
    g[n].forEach(t=>{
      const li=document.createElement("li");
      li.textContent=t.title;
      ul.appendChild(li);
    });
    card.appendChild(ul);
    list.appendChild(card);
  });

  c.appendChild(list);
}

/* ------ Корзина ------ */

function renderTrash(){
  const c=document.getElementById("trashView");
  c.innerHTML="";

  const title=document.createElement("h2");
  title.textContent="Корзина";
  c.appendChild(title);

  const now=Date.now();
  const items=state.tasks.filter(t=>
    t.deletedAt && now-t.deletedAt<30*24*60*60*1000
  );

  if(!items.length){
    c.innerHTML+="<p>Корзина пуста.</p>";
    return;
  }

  const list=document.createElement("div");
  list.className="simple-list";

  items.forEach(t=>{
    const card=document.createElement("div");
    card.className="simple-card";

    const h=document.createElement("div");
    h.className="simple-card-header";
    h.textContent=t.title;
    card.appendChild(h);

    const meta=document.createElement("div");
    meta.className="simple-card-meta";
    const sphere=state.spheres.find(s=>s.id===t.sphereId);
    meta.textContent=`Сфера: ${sphere?sphere.name:"Без сферы"}`;
    card.appendChild(meta);

    const res=document.createElement("button");
    res.className="btn btn-ghost";
    res.textContent="Восстановить";
    res.onclick=()=>{
      t.deletedAt=null;
      saveState();
      renderAll();
    };

    const del=document.createElement("button");
    del.className="btn btn-ghost";
    del.textContent="Удалить навсегда";
    del.onclick=()=>{
      if(confirm("Удалить?")){
        state.tasks=state.tasks.filter(x=>x.id!==t.id);
        saveState();
        renderTrash();
      }
    };

    card.appendChild(res);
    card.appendChild(del);

    list.appendChild(card);
  });

  c.appendChild(list);
}

/* ------ Отчёт ------ */

function renderReport(){
  const c=document.getElementById("reportView");
  c.innerHTML="<h2>Отчёт за месяц</h2>";

  const now=new Date();
  const m=now.getMonth(), y=now.getFullYear();

  const done=state.tasks.filter(t=>{
    if(!t.completedAt || t.deletedAt) return false;
    const d=new Date(t.completedAt);
    return d.getMonth()===m && d.getFullYear()===y;
  });

  if(!done.length){
    c.innerHTML+="<p>Нет выполненных задач.</p>";
    return;
  }

  const g={};
  done.forEach(t=>{
    const s=state.spheres.find(x=>x.id===t.sphereId);
    const n=s?s.name:"Без сферы";
    (g[n]=g[n]||[]).push(t);
  });

  const list=document.createElement("div");
  list.className="simple-list";

  Object.keys(g).sort().forEach(n=>{
    const card=document.createElement("div");
    card.className="simple-card";

    const h=document.createElement("div");
    h.className="simple-card-header";
    h.textContent=n + " — выполнено: " + g[n].length;
    card.appendChild(h);

    const ul=document.createElement("ul");
    g[n].forEach(t=>{
      const li=document.createElement("li");
      li.textContent = `[${new Date(t.completedAt).toLocaleDateString()}] ${t.title}`;
      ul.appendChild(li);
    });

    card.appendChild(ul);
    list.appendChild(card);
  });

  c.appendChild(list);
}
