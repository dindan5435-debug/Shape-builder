(function () {
  "use strict";

  var SHAPE_OPTIONS = [
    { id: "box", label: "กล่องสี่เหลี่ยม" },
    { id: "cylinder", label: "ทรงกระบอก" },
    { id: "cone", label: "กรวย" },
    { id: "pyramid", label: "พีระมิด" },
    { id: "prism", label: "ปริซึม (ฐานหลายเหลี่ยม)" },
    { id: "sphere", label: "ทรงกลม" },
  ];

  var SHAPE_INFO = {
    box: "ทรงตัน 6 หน้า ทุกหน้าเป็นสี่เหลี่ยม ขอบทุกเส้นตั้งฉากกัน",
    cylinder: "ฐานวงกลม 2 ด้านขนานกัน เชื่อมด้วยผิวโค้งเรียบ",
    cone: "ฐานวงกลม เรียวขึ้นไปบรรจบที่จุดยอดเดียว",
    pyramid: "ฐานหลายเหลี่ยม เรียวขึ้นไปบรรจบที่จุดยอดเดียว — ลองสลับเป็น “มุมจากสัน” เพื่อดูว่าภาพฉายเปลี่ยนไปยังไง",
    prism: "ฐานหลายเหลี่ยม 2 ด้านขนานกัน เชื่อมด้วยหน้าสี่เหลี่ยมเรียบ",
    sphere: "ทุกจุดบนผิวห่างจากจุดศูนย์กลางเท่ากันหมด",
  };

  var FIXED_DIMS = {
    box: { width: 60, height: 50, depth: 40 },
    cylinder: { radius: 25, height: 60 },
    cone: { radius: 30, height: 70 },
    pyramid: { radius: 50, height: 75, sides: 4 },
    prism: { radius: 35, height: 60, sides: 3 },
    sphere: { radius: 35 },
  };

  var CORNER_TOGGLE_SHAPES = ["box", "pyramid", "prism"];
  var MESH_COLOR = 0x8ca3c4;
  var EDGE_COLOR = 0x16324f;

  function buildGeometry(shapeType) {
    var d = FIXED_DIMS[shapeType] || FIXED_DIMS.box;
    switch (shapeType) {
      case "box":
        return new THREE.BoxGeometry(d.width, d.height, d.depth);
      case "cylinder":
        return new THREE.CylinderGeometry(d.radius, d.radius, d.height, 32);
      case "cone":
        return new THREE.ConeGeometry(d.radius, d.height, 32);
      case "pyramid":
        return new THREE.ConeGeometry(d.radius, d.height, d.sides);
      case "prism":
        return new THREE.CylinderGeometry(d.radius, d.radius, d.height, d.sides);
      case "sphere":
        return new THREE.SphereGeometry(d.radius, 32, 16);
      default:
        return new THREE.BoxGeometry(50, 50, 50);
    }
  }

  var state = {
    shapeType: "pyramid",
    cornerView: false,
    sideViewSide: "left",
  };

  var el = {
    shapeSelect: document.getElementById("shape-select"),
    shapeInfo: document.getElementById("shape-info"),
    cornerToggleWrap: document.getElementById("corner-toggle-wrap"),
    cornerBtnFlat: document.getElementById("corner-btn-flat"),
    cornerBtnCorner: document.getElementById("corner-btn-corner"),
    sideBtnLeft: document.getElementById("side-btn-left"),
    sideBtnRight: document.getElementById("side-btn-right"),
    orthoHeading: document.getElementById("ortho-heading"),
    cellA: document.getElementById("cell-a"),
    cellB: document.getElementById("cell-b"),
    cellC: document.getElementById("cell-c"),
    cellD: document.getElementById("cell-d"),
    frontPanel: document.getElementById("panel-front"),
    sidePanel: document.getElementById("panel-side"),
    topPanel: document.getElementById("panel-top"),
    sideLabel: document.getElementById("side-label"),
    mainLabel: document.getElementById("main-label"),
    titleLabel: document.getElementById("title-label"),
    resetBtn: document.getElementById("reset-view-btn"),
    fileInput: document.getElementById("ref-image-input"),
    refImage: document.getElementById("ref-image-preview"),
    mainCanvas: document.getElementById("canvas-main"),
    frontCanvas: document.getElementById("canvas-front"),
    topCanvas: document.getElementById("canvas-top"),
    sideCanvas: document.getElementById("canvas-side"),
    installBtn: document.getElementById("install-btn"),
  };

  SHAPE_OPTIONS.forEach(function (o) {
    var opt = document.createElement("option");
    opt.value = o.id;
    opt.textContent = o.label;
    el.shapeSelect.appendChild(opt);
  });
  el.shapeSelect.value = state.shapeType;

  // ---- three.js ----
  var scene = new THREE.Scene();
  var key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(120, 220, 160);
  scene.add(key);
  var fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
  fillLight.position.set(-150, 80, -120);
  scene.add(fillLight);
  var ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  var group = new THREE.Group();
  scene.add(group);

  var mainCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 200000);
  var frontCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200000);
  var topCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200000);
  var sideCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200000);

  var mainRenderer = new THREE.WebGLRenderer({ canvas: el.mainCanvas, antialias: true });
  var frontRenderer = new THREE.WebGLRenderer({ canvas: el.frontCanvas, antialias: true });
  var topRenderer = new THREE.WebGLRenderer({ canvas: el.topCanvas, antialias: true });
  var sideRenderer = new THREE.WebGLRenderer({ canvas: el.sideCanvas, antialias: true });
  [mainRenderer, frontRenderer, topRenderer, sideRenderer].forEach(function (r) {
    r.setClearColor(0xfafbfc, 1);
  });

  var controls = new THREE.OrbitControls(mainCamera, mainRenderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  mainCamera.position.set(180, 160, 220);
  controls.update();

  var mesh = null;
  var edges = null;
  var orthoHalfExtent = 100;
  var sideDist = 400;

  function resizeAll() {
    function setSizeFor(canvas, renderer, camera, isOrtho) {
      var parent = canvas.parentElement;
      var w = Math.max(1, parent.clientWidth);
      var h = Math.max(1, parent.clientHeight);
      renderer.setSize(w, h, false);
      if (isOrtho) {
        var half = orthoHalfExtent || 100;
        var aspect = w / h;
        camera.left = -half * aspect;
        camera.right = half * aspect;
        camera.top = half;
        camera.bottom = -half;
        camera.updateProjectionMatrix();
      } else {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    }
    setSizeFor(el.mainCanvas, mainRenderer, mainCamera, false);
    setSizeFor(el.frontCanvas, frontRenderer, frontCamera, true);
    setSizeFor(el.topCanvas, topRenderer, topCamera, true);
    setSizeFor(el.sideCanvas, sideRenderer, sideCamera, true);
  }

  function applyCornerRotation() {
    var angle = state.cornerView && CORNER_TOGGLE_SHAPES.indexOf(state.shapeType) !== -1 ? 45 : 0;
    group.rotation.set(0, THREE.MathUtils.degToRad(angle), 0);
  }

  function applySideCamera() {
    var sign = state.sideViewSide === "left" ? -1 : 1;
    sideCamera.position.set(sign * sideDist, 0, 0);
    sideCamera.up.set(0, 1, 0);
    sideCamera.lookAt(0, 0, 0);
  }

  function rebuildMesh() {
    if (mesh) {
      group.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    if (edges) {
      group.remove(edges);
      edges.geometry.dispose();
      edges.material.dispose();
    }
    var geometry = buildGeometry(state.shapeType);
    var flat = state.shapeType === "pyramid" || state.shapeType === "prism";
    var material = new THREE.MeshStandardMaterial({
      color: MESH_COLOR,
      flatShading: flat,
      metalness: 0.05,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    mesh = new THREE.Mesh(geometry, material);
    var edgesGeo = new THREE.EdgesGeometry(geometry, 15);
    var edgesMat = new THREE.LineBasicMaterial({ color: EDGE_COLOR });
    edges = new THREE.LineSegments(edgesGeo, edgesMat);
    group.add(mesh);
    group.add(edges);

    geometry.computeBoundingSphere();
    var r = (geometry.boundingSphere && geometry.boundingSphere.radius) || 60;
    orthoHalfExtent = r * 1.35;
    var dist = r * 6 + 200;
    sideDist = dist;

    frontCamera.position.set(0, 0, dist);
    frontCamera.up.set(0, 1, 0);
    frontCamera.lookAt(0, 0, 0);

    topCamera.position.set(0, dist, 0);
    topCamera.up.set(0, 0, -1);
    topCamera.lookAt(0, 0, 0);

    applySideCamera();
    applyCornerRotation();

    var camDist = Math.max(140, r * 4.2);
    mainCamera.position.set(camDist * 0.6, camDist * 0.5, camDist * 0.7);
    controls.target.set(0, 0, 0);
    controls.update();

    resizeAll();
  }

  function updateOrthoLayout() {
    if (state.sideViewSide === "left") {
      el.cellA.appendChild(el.frontPanel);
      el.cellB.appendChild(el.sidePanel);
      el.cellC.appendChild(el.topPanel);
      el.orthoHeading.textContent = "มุมมองฉาย — First Angle (Front ซ้าย / Left ขวา / Top ใต้ Front)";
      el.sideLabel.textContent = "LEFT — ด้านข้าง (ซ้าย)";
    } else {
      el.cellA.appendChild(el.sidePanel);
      el.cellB.appendChild(el.frontPanel);
      el.cellD.appendChild(el.topPanel);
      el.orthoHeading.textContent = "มุมมองฉาย — First Angle (Right ซ้าย / Front ขวา / Top ใต้ Front)";
      el.sideLabel.textContent = "RIGHT — ด้านข้าง (ขวา)";
    }
    resizeAll();
  }

  function updateUI() {
    el.shapeInfo.textContent = SHAPE_INFO[state.shapeType] || "";
    var showCorner = CORNER_TOGGLE_SHAPES.indexOf(state.shapeType) !== -1;
    el.cornerToggleWrap.classList.toggle("hidden", !showCorner);
    el.cornerBtnFlat.classList.toggle("active", !state.cornerView);
    el.cornerBtnCorner.classList.toggle("active", state.cornerView);
    el.sideBtnLeft.classList.toggle("active", state.sideViewSide === "left");
    el.sideBtnRight.classList.toggle("active", state.sideViewSide === "right");
    var found = SHAPE_OPTIONS.filter(function (o) { return o.id === state.shapeType; })[0];
    var shapeLabel = found ? found.label : "";
    el.mainLabel.textContent = shapeLabel + " — ลากหมุน / เลื่อนล้อซูม";
    el.titleLabel.textContent = "TITLE: " + shapeLabel;
  }

  el.shapeSelect.addEventListener("change", function (e) {
    state.shapeType = e.target.value;
    rebuildMesh();
    updateUI();
  });
  el.cornerBtnFlat.addEventListener("click", function () {
    state.cornerView = false;
    applyCornerRotation();
    updateUI();
  });
  el.cornerBtnCorner.addEventListener("click", function () {
    state.cornerView = true;
    applyCornerRotation();
    updateUI();
  });
  el.sideBtnLeft.addEventListener("click", function () {
    state.sideViewSide = "left";
    applySideCamera();
    updateOrthoLayout();
    updateUI();
  });
  el.sideBtnRight.addEventListener("click", function () {
    state.sideViewSide = "right";
    applySideCamera();
    updateOrthoLayout();
    updateUI();
  });
  el.resetBtn.addEventListener("click", function () {
    mainCamera.position.set(180, 160, 220);
    controls.target.set(0, 0, 0);
    controls.update();
  });
  el.fileInput.addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      el.refImage.src = reader.result;
      el.refImage.style.display = "block";
    };
    reader.readAsDataURL(file);
  });
  window.addEventListener("resize", resizeAll);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    mainRenderer.render(scene, mainCamera);
    frontRenderer.render(scene, frontCamera);
    topRenderer.render(scene, topCamera);
    sideRenderer.render(scene, sideCamera);
  }

  updateOrthoLayout();
  rebuildMesh();
  updateUI();
  animate();

  // ---- installability ----
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (el.installBtn) el.installBtn.classList.remove("hidden");
  });
  if (el.installBtn) {
    el.installBtn.addEventListener("click", function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        el.installBtn.classList.add("hidden");
      });
    });
  }

  // ---- service worker ----
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function (err) {
        console.warn("SW registration failed:", err);
      });
    });
  }
})();
