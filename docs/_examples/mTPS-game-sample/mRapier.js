import { GUI } from '/mTPS-game-sample/lib/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-compat'

await RAPIER.init();
console.log("RAPIER:");

/*const btn = document.getElementById("start");
btn.addEventListener("click", mbuttonAction, false);
function mbuttonAction(){
    console.log("mbuttonAction")
    init()
}*/


init();

//window.addEventListener('DOMContentLoaded', init);
function init() {

    window.onkeydown = function(e) {
        if (e.keyCode == 9)
          return false; // Disable Tab!
     
        if( (e.keyCode == 32) ) 
          return false; // Disable Space!
    
        // if (e.key == "Escape")
        //   return false;
    }

    const textureLoader = new THREE.TextureLoader();
    const buildTexture = textureLoader.load('/mTPS-game-sample/image/ch01_woodplank_long_dif.png');
    const buildTempTexture = textureLoader.load('/mTPS-game-sample/image/build_temp.png');

    let mArrayAudio = [];

    function loadAudio(url) {
        return fetch(url,{mode: 'cors'})
          .then(response => response.arrayBuffer())
          .then(arrayBuffer => {
              //mode: 'cors'
              //credentials: 'omit'
            return new Promise((resolve, reject) => {
              audioContext.decodeAudioData(arrayBuffer, (audioBuffer) => {
                resolve(audioBuffer);
              }, (err) => {
                reject(err);
              });
            });
          });
      }
      
    function loadAudios() {
        let promises = [
            loadAudio('/mTPS-game-sample/sound/bullet-hit-001.mp3'),
            loadAudio('/mTPS-game-sample/sound/handgun.mp3'),
            loadAudio('/mTPS-game-sample/sound/build-destory.mp3'),
            loadAudio('/mTPS-game-sample/sound/sliding.mp3'),
            loadAudio('/mTPS-game-sample/sound/build01.mp3'),
        ];
        Promise.all(promises).then(audioBuffers => {
            
            for(var i=0;i<audioBuffers.length;i++){
                mArrayAudio[i] = audioBuffers[i];
                console.log(audioBuffers[i])
            }
            console.log("sound loaded")
        });    
    
    }
    loadAudios()

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();

    function mPlayAudioBuffer(audioBuffer, volume = 1.0, loop = false) {
        const audioSource = audioContext.createBufferSource();
        audioSource.buffer = audioBuffer;
        //console.log("volume:"+volume);

        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;
        gainNode.connect(audioContext.destination);
        audioSource.connect(gainNode);
        audioSource.loop = loop;
        audioSource.start();
    }


    
    let width = window.innerWidth;
    let height = window.innerHeight;
    const canvas2d = document.querySelector( '#canvas-2d' );

    
    let g_scale = 20.0; //20.0
    const gravity = new RAPIER.Vector3(0.0, -9.81*g_scale, 0.0)
    const world = new RAPIER.World(gravity)
    
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    const canvas3d = document.querySelector( '#canvas' );
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas3d, //document.querySelector('#canvas')
        antialias: true
    });
    //const main_canvas = document.querySelector( '#main_canvas' );
    //let width = document.getElementById('main_canvas').getBoundingClientRect().width;
    //let height = document.getElementById('main_canvas').getBoundingClientRect().height;
    
    renderer.setPixelRatio(window.devicePixelRatio);
    //renderer.setClearColor(new THREE.Color('darkblue')); //'gray'
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    console.log(window.devicePixelRatio);
    console.log(width+", "+height);

    let resolution;
    resolution = new THREE.Vector2();
    renderer.getSize(resolution);
 
    const scene = new THREE.Scene();

    let mScale = 1;
    let grid_size = mScale*5;
    let gridH_size = mScale*4;
    let buildThick = grid_size*0.04;
    let slope_ang = Math.acos(grid_size / Math.sqrt(grid_size*grid_size+gridH_size*gridH_size) )
    let grid_num = 10;
    let tol = 1E-5;

 
    let camera = new THREE.PerspectiveCamera(80, width / height, mScale*0.01, mScale * 100);
    let mCameraOffset = new Object();
    mCameraOffset.dx = mScale*0.5//  0.5;
    mCameraOffset.dy = mScale*0.6; //1.4
    mCameraOffset.dz = mScale*1.6; //1000*1.6;
    
    function mSetCameraPosition(camera, offset, player){

        if(!player.playerMesh){
            return
        }

        let p = player.playerMesh.position //model.position;
        let dx = offset.dx; // 1000*0.1;
        let dy = offset.dy; //1000*1.4;
        let dz = offset.dz; //1000*1.6;
        if(c_player.isCrouch || c_player.isSliding){
            dy *= 0.5
        }
       
        if(playerRight){
            //let dir = new THREE.Vector3();
            //playerRight.getWorldDirection(dir)
            //console.log("dir:", dir);
            let {hit, ray} = mPlayerRayHit(playerRight);
            if (hit != null) {
                //console.log("hit.timeOfImpact:", hit.timeOfImpact);
                if(hit.timeOfImpact < offset.dx - playerRadius){
                    //console.log("hit.timeOfImpact:", hit.timeOfImpact);
                    dx = hit.timeOfImpact + playerRadius;
                }
            }
        }
        playerPiv1.position.x = -dx;

        if(playerPiv1){
            let {hit, ray} = mPlayerRayHit(playerPiv1, -1);
            if (hit != null) {
                //console.log("hit.timeOfImpact:", hit.timeOfImpact);
                if(hit.timeOfImpact < offset.dz){
                    dz = hit.timeOfImpact;
                }
            }
        }

        if(playerPiv2){
            playerPiv2.position.z = -dz + 0.001;
            let cp = playerPiv2.getWorldPosition(new THREE.Vector3());
            //console.log("cp:", cp);
            camera.position.set(cp.x, cp.y, cp.z);
            camera.rotation.order = "YXZ";
            camera.rotation.y =  player.angle + Math.PI;
            camera.rotation.x = player.angle2;
            //console.log("camera.rotation.y:", camera.rotation.y);

            if(props.frontView){
                playerPiv1.position.y = 0
                playerPiv2.position.z = dz*1.0
                let cp = playerPiv2.getWorldPosition(new THREE.Vector3());
                //console.log("cp:", cp);
                camera.position.set(cp.x, cp.y, cp.z);
                camera.rotation.order = "YXZ";
                camera.rotation.y =  player.angle;
                camera.rotation.x = player.angle2;
            }
        }
        //console.log("camera.position:", camera.position);

        // weapon
        playerPiv1.position.y = dy;
        //weaponMesh.position.z = -dz;
    }

    //--- Light ---//
    let light_pos0 = new THREE.Vector3();
    light_pos0.x = 0;
    light_pos0.y = gridH_size* grid_num;
    light_pos0.z = grid_size*3;
    const light = new THREE.DirectionalLight(0xFFFFFF);
    light.position.set(light_pos0.x, light_pos0.y, light_pos0.z);
    light.intensity = 1; 
    light.castShadow = true; //false; //
    console.log("light.shadow.camera:%o", light.shadow.camera);
    let s_ = grid_size * grid_num *0.3;
    light.shadow.camera.top *= s_;
    light.shadow.camera.bottom *= s_;
    light.shadow.camera.left *= s_;
    light.shadow.camera.right *= s_;
    light.shadow.mapSize.width = 1024 * 8
    light.shadow.mapSize.height = 1024 * 8
    //light.shadow.camera.near = gridH_size*grid_num
    light.shadow.camera.far = gridH_size*grid_num*1.3;
    light.shadow.bias = -0.005;  //-0.0005;
    scene.add(light);
    //const light = new THREE.SpotLight(0xffffff, 400, 100, Math.PI / 4, 1);
    //light.castShadow = true;
    //scene.add(light);

    const light2 = new THREE.DirectionalLight(0xFFFFFF);
    light2.position.set(grid_size*3, gridH_size* grid_num, -grid_size*3);
    light2.intensity = 1; 
    scene.add(light2);

    /*const light3 = new THREE.DirectionalLight(0xFFFFFF);
    light2.position.set(grid_size*3, gridH_size* grid_num, 0);
    light2.intensity = 0.1; 
    scene.add(light2);*/

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight);


    //--- Environment ---//
    new THREE.RGBELoader()
        .setPath( 'image/' )
        .load( 'quarry_01_1k.hdr', function ( texture ) {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.background = texture;
            scene.environment = texture;
        } );


    //--- Character model ---//
    //const url = '/mTPS-game-sample/model/no0.glb';
    
    let playerMesh = new THREE.Group();
    let playerRadius = 0.35 * mScale;
    //playerMesh.castShadow = true;
    //playerMesh.receiveShadow = true;
    let playerRight = new THREE.Group();
    let playerPiv1 = new THREE.Group();
    let playerPiv2 = new THREE.Group();

    //let model = null;
    //let mAxes = null;
    
    let mixer;
    let props, lastAnimID;
    let arrayAction = new Array(30); //[];
    let mAnimOrder = {Idle:0, RunForward:1, RunBack:2, RunLeft:3, RunRight:4, 
                    Jump:5, 
                    CrouchIdle:6, CrouchForward:7, CrouchBack:8,  CrouchLeft:9,  CrouchRight:10,  
                    Slide:11,
                    ShootIdle:12, ShootStand: 13, ShootCrouch:14 };
    let model_scale = mScale*0.01;  // 10;
    const loader = new THREE.FBXLoader();
    loader.load( 'model/mSet14.fbx', function ( object ) {

        console.log("object:%o", object);
        //object.children[1].visible = false;

        mixer = new THREE.AnimationMixer( object );
        console.log("object.animations.length:"+object.animations.length)
        for(var i = 0; i<object.animations.length; i++){
            console.log("%o", object.animations[ i ]);
            //arrayAction.push( mixer.clipAction(object.animations[ i ]) );
            if(object.animations[i].name=="Slide"){
                object.animations[i] = THREE.AnimationUtils.subclip(object.animations[i], 'Slide', 1, 27);
            }
            arrayAction[ mAnimOrder[object.animations[i].name] ] = mixer.clipAction(object.animations[ i ]);
        }
        arrayAction[0].play();
        //arrayAction[6].play();

        arrayAction[5].setLoop(THREE.LoopOnce);
        arrayAction[5].clampWhenFinished = true;

        //--- Slide
        arrayAction[11].setLoop(THREE.LoopOnce);
        arrayAction[11].clampWhenFinished = true;

        object.traverse( function ( child ) {
            if ( child.isMesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        } );
        c_player.model = object;
        c_player.playerMesh = playerMesh;

        object.scale.set(model_scale, model_scale, model_scale);
        object.position.set(0, -playerRadius*2.5, 0);
        playerMesh.add(object);
        scene.add( playerMesh );

        playerRight.position.set(-playerRadius-tol, 0, 0);
        playerRight.rotation.y = -Math.PI/2;
        playerMesh.add(playerRight);
        
        playerPiv1.position.set(-mCameraOffset.dx, mCameraOffset.dy, 0);
        playerMesh.add(playerPiv1);
        
        const size = mScale*0.2;
        let ax = new THREE.AxesHelper(size);
        ax.visible = false;
        playerPiv1.add(ax);

        playerPiv2.position.set(0, 0, -mCameraOffset.dz);
        playerPiv1.add(playerPiv2);
        
        //mSetCameraPosition(camera, mCameraOffset, c_player); //playerMesh
    } );

    let weaponMesh = new THREE.Group();
    let mWeaponOffset = new Object();
    mWeaponOffset.dx = -mCameraOffset.dx; //mScale*-0.2;
    //mWeaponOffset.dy = mCameraOffset.dy *0.73; //mScale*0.5; //1.4
    //mWeaponOffset.dz = -mCameraOffset.dz*0.9; //*0.9; 
    mWeaponOffset.dy = -0.161;
    mWeaponOffset.dz = mCameraOffset.dz*0.1; //*0.9; 
    let muzzlePos = new THREE.Object3D();

    loader.load( 'model/Scar_L01.fbx', function ( object ) {

        console.log("object:%o", object);

        object.traverse( function ( child ) {
            if ( child.isMesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        } );
        object.scale.set(0.002, 0.002, 0.002);
        //object.position.set(-0.2, 0.5, 0.5);

        weaponMesh.add(object)
        weaponMesh.visible = false;
        c_player.weaponMesh = weaponMesh;
        /*weaponMesh.position.set(mWeaponOffset.dx, mWeaponOffset.dy, mWeaponOffset.dz);
        playerMesh.add(weaponMesh);*/

        /*weaponMesh.position.set(0, -0.161, mWeaponOffset.dz);
        playerPiv1.add(weaponMesh);
        muzzlePos.position.set(0, -0.161, mWeaponOffset.dz*0.6);
        playerPiv1.add(muzzlePos);*/

        weaponMesh.position.set(0, mWeaponOffset.dy, mWeaponOffset.dz);
        playerPiv2.add(weaponMesh);

        muzzlePos.position.set(0, mWeaponOffset.dy, mCameraOffset.dz*0.4);
        playerPiv2.add(muzzlePos);

    } );

    /*const loaderW = new THREE.GLTFLoader();
    const url = '/mTPS-game-sample/model/no0.glb';
    loaderW.load(
        url, 
        function ( gltf ){
            model = gltf.scene;
            model.name = "model_with_cloth";
            model.scale.set(model_scale, model_scale, model_scale);
            model.position.set(0, 0, 0);
            playerMesh.add(model);

        },
        function ( error ) {
            console.log( 'An error happened' );
            //console.log( error );
        }
    );*/


    //--- Global Axis ---//
    const size = grid_size*0.1;
    let gAxes = new THREE.AxesHelper(size);
    gAxes.position.x =  0;
    gAxes.position.y = mScale*0.1; 
    scene.add(gAxes);
    
    //--- Grid ---//
    const grid = new THREE.GridHelper( grid_size*grid_num*2, grid_num*2, "white", "white" );
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    scene.add( grid );

    //--- ground
    const mesh = new THREE.Mesh( new THREE.PlaneGeometry( grid_size*grid_num*2, grid_size*grid_num*2 ), new THREE.MeshPhongMaterial( { color: '#101090' } ) );//, depthWrite: false #'#010190'
    mesh.rotation.x = - Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add( mesh );
        const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0))
        const floorShape = RAPIER.ColliderDesc.cuboid(grid_size*grid_num, 0.5, grid_size*grid_num)
        world.createCollider(floorShape, floorBody)

    let ArrayMesh = [];
    let ArrayBody = [];
    let mMaterial = new THREE.MeshLambertMaterial({color: 0x6699FF});
    mMaterial.transparent = true;
    mMaterial.opacity = 1.0;

    //--- Cube
    const cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mMaterial)
    cubeMesh.castShadow = true
    scene.add(cubeMesh)
        const cubeBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(grid_size*0, 1, -grid_size))
        const cubeShape = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1).setRestitution(0.0).setFriction(0.0)
        world.createCollider(cubeShape, cubeBody)
    ArrayMesh.push(cubeMesh);
    ArrayBody.push(cubeBody);

    const cubeMesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mMaterial)
    cubeMesh1.castShadow = true
    scene.add(cubeMesh1)
        const cubeBody1 = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(grid_size*1, 0.5, -grid_size))
        const cubeShape1 = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1).setRestitution(0.0).setFriction(0.0)
        world.createCollider(cubeShape1, cubeBody1)
    ArrayMesh.push(cubeMesh1);
    ArrayBody.push(cubeBody1);

    const cubeMesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mMaterial)
    cubeMesh2.castShadow = true
    scene.add(cubeMesh2)
        const cubeBody2 = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(grid_size*2, 2.5, -grid_size))
        const cubeShape2 = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setMass(1).setRestitution(0.0).setFriction(0.0)
        world.createCollider(cubeShape2, cubeBody2)
    ArrayMesh.push(cubeMesh2);
    ArrayBody.push(cubeBody2);

    let ArrayBuild = {}; //[]; // should use object?
    let build_id = 0;

    function mCreateWall(px, py, pz, type="z"){
        let Lx = grid_size;
        let Ly = gridH_size;
        let Lz = buildThick;
        if(type == "x"){
            Lz = grid_size;
            Lx = buildThick;
        }
    
        //let mat = new THREE.MeshLambertMaterial({color: 0x6699FF, side: THREE.DoubleSide});
        let mat = new THREE.MeshLambertMaterial({map: buildTexture, side: THREE.DoubleSide});
        mat.transparent = true;
        mat.opacity = 1.0;
    
        const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(Lx, Ly, Lz), mat)
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        wallMesh.buildType = 0;
        scene.add(wallMesh)
            const wallBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz))
            const wallShape = RAPIER.ColliderDesc.cuboid(Lx/2, Ly/2, Lz/2).setMass(1).setRestitution(0.0).setFriction(0.0)
            let col = world.createCollider(wallShape, wallBody)
            col.build_id = build_id;
            //console.log("col:%o", col);
        ArrayMesh.push(wallMesh);
        ArrayBody.push(wallBody);
        
        mAddBuild(col, wallMesh, wallBody)
        build_id += 1; 
    }

    function mAddBuild(col, mesh, body){
        let b = new Object();
        b.build_id = build_id;
        b.collider = col;
        b.buildMesh = mesh;
        b.body = body;
        b.maxHealth = 150;
        b.health = 150;
        //ArrayBuild[col.handle] = b;
        ArrayBuild[build_id] = b;
    }

    mCreateWall(-grid_size*2+grid_size/2, gridH_size/2, -grid_size*2)
    mCreateWall(-grid_size*3+grid_size/2, gridH_size/2, -grid_size*2)
    for(var i=0; i<grid_num; i++){
        mCreateWall(grid_size*(-i), gridH_size/2, grid_size*1+grid_size/2, "x")
    }
    for(var i=-grid_num; i<grid_num; i++){
        mCreateWall(grid_size*i+grid_size/2, gridH_size/2, -grid_size*grid_num)
    }
    

    //console.log("ArrayBuild:%o", ArrayBuild);

    function mCreateSlope(px, py, pz, type="z-"){
        console.log("mCreateSlope:"+type)
        let L = Math.sqrt(grid_size*grid_size+gridH_size*gridH_size)
            //console.log("L:"+L)
        let Lx = grid_size
        let Ly = buildThick
        let Lz = L
        if( type==="x+" || type==="x-" ){
            Lz = grid_size
            Lx = L
        }
        //console.log("L:"+Lx+", "+Ly+", "+Lz)

        //let mat = new THREE.MeshLambertMaterial({color: 0x6699FF, side: THREE.DoubleSide});
        let mat = new THREE.MeshLambertMaterial({map: buildTexture, side: THREE.DoubleSide});
        mat.transparent = true;
        mat.opacity = 1.0;

        const slopeMesh = new THREE.Mesh(new THREE.BoxGeometry(Lx, Ly, Lz), mat)
        slopeMesh.castShadow = true
        slopeMesh.receiveShadow = true;
        slopeMesh.buildType = 2;
        scene.add(slopeMesh)
            let a = Math.acos(grid_size/L)
            if(type==="z+" || type==="x-"){
                a = -a;
            }
            let w = Math.cos(a/2)
            let x = 1.0*Math.sin(a/2)
            let y = 0.0
            let z = 0.0
            if(type==="x+" || type==="x-"){
                z = 1.0*Math.sin(a/2)
                x = 0.0
            }
            
            const slopeBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz).setRotation({ w: w, x: x, y: y, z: z }))
            const slopeShape = RAPIER.ColliderDesc.cuboid(Lx/2, Ly/2, Lz/2).setMass(1).setRestitution(0.0).setFriction(0.0)
            const slopeCollider = world.createCollider(slopeShape, slopeBody)
            slopeCollider.build_id = build_id;
        ArrayMesh.push(slopeMesh);
        ArrayBody.push(slopeBody);

        //console.log("slopeCollider.handle:", slopeCollider.handle)

        mAddBuild(slopeCollider, slopeMesh, slopeBody)
        build_id += 1; 
    }

    mCreateSlope(-grid_size*5+grid_size/2, gridH_size/2, -grid_size*1+grid_size/2, "z+")

    mCreateSlope(-grid_size*4+grid_size/2, gridH_size/2, -grid_size*2+grid_size/2)
    mCreateSlope(-grid_size*4+grid_size/2, gridH_size*1+gridH_size/2, -grid_size*3+grid_size/2)
    mCreateSlope(-grid_size*4+grid_size/2, gridH_size*2+gridH_size/2, -grid_size*4+grid_size/2)

    mCreateSlope(-grid_size*4+grid_size/2, gridH_size*0+gridH_size/2, grid_size*3+grid_size/2, "x+")
    mCreateFloor(-grid_size*3+grid_size/2, gridH_size*1, grid_size*3+grid_size/2)
    mCreateFloor(-grid_size*3+grid_size/2, gridH_size*1, grid_size*4+grid_size/2)
    mCreateSlope(-grid_size*4+grid_size/2, gridH_size*1+gridH_size/2, grid_size*4+grid_size/2, "x-")
    mCreateFloor(-grid_size*5+grid_size/2, gridH_size*2, grid_size*3+grid_size/2)
    mCreateFloor(-grid_size*5+grid_size/2, gridH_size*2, grid_size*4+grid_size/2)
    
    mCreateSlope(-grid_size*4+grid_size/2, gridH_size*2+gridH_size/2, grid_size*3+grid_size/2, "x+")
    mCreateFloor(-grid_size*3+grid_size/2, gridH_size*3, grid_size*3+grid_size/2)
    mCreateFloor(-grid_size*3+grid_size/2, gridH_size*3, grid_size*4+grid_size/2)
    mCreateSlope(-grid_size*4+grid_size/2, gridH_size*3+gridH_size/2, grid_size*4+grid_size/2, "x-")
    mCreateFloor(-grid_size*5+grid_size/2, gridH_size*4, grid_size*3+grid_size/2)
    mCreateFloor(-grid_size*5+grid_size/2, gridH_size*4, grid_size*4+grid_size/2)


    function mCreateFloor(px, py, pz){    
        //let mat = new THREE.MeshLambertMaterial({color: 0x6699FF});
        let mat = new THREE.MeshLambertMaterial({map: buildTexture, side: THREE.DoubleSide});
        mat.transparent = true;
        mat.opacity = 1.0;

        const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(grid_size, buildThick, grid_size), mat)
        floorMesh.castShadow = true
        floorMesh.receiveShadow = true;
        floorMesh.buildType = 1;
        scene.add(floorMesh)
            const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz))
            const floorShape = RAPIER.ColliderDesc.cuboid(grid_size/2, buildThick/2, grid_size/2).setMass(1).setRestitution(0.0).setFriction(0.0)
            const floorCollider = world.createCollider(floorShape, floorBody)
            floorCollider.build_id = build_id;
        ArrayMesh.push(floorMesh);
        ArrayBody.push(floorBody);

        mAddBuild(floorCollider, floorMesh, floorBody)
        build_id += 1; 
    }

    mCreateFloor(-grid_size*4+grid_size/2, gridH_size*3, -grid_size*5+grid_size/2)
    mCreateFloor(-grid_size*3+grid_size/2, gridH_size, -grid_size*3+grid_size/2)

    function mCreateConeGeometry(){
        const geometry = new THREE.BufferGeometry();
        /*let vertices = new Float32Array(5*3);
        let uvs = new Float32Array(5*2);
        let indices = new Uint32Array(4*3);
        let cone_coord = [ 0, 0, 0,
                          -grid_size/2, -gridH_size/2, -grid_size/2,
                          -grid_size/2, -gridH_size/2,  grid_size/2,
                           grid_size/2, -gridH_size/2,  grid_size/2,
                           grid_size/2, -gridH_size/2, -grid_size/2];
        let uv_coord = [0.5, 1.0,
                        0.0, 0.0,
                        1.0, 0.0,
                        0.0, 0.0,
                        1.0, 0.0 ];*/
        let vertices = new Float32Array(12*3);
        let uvs = new Float32Array(12*2);
        let indices = new Uint32Array(4*3);
        let cone_coord = [ 
        -grid_size/2, -gridH_size/2, -grid_size/2,
        -grid_size/2, -gridH_size/2,  grid_size/2,
        0, 0, 0,
        -grid_size/2, -gridH_size/2,  grid_size/2,
         grid_size/2, -gridH_size/2,  grid_size/2,
        0, 0, 0,
         grid_size/2, -gridH_size/2,  grid_size/2,
         grid_size/2, -gridH_size/2, -grid_size/2,
        0, 0, 0,
         grid_size/2, -gridH_size/2, -grid_size/2,
        -grid_size/2, -gridH_size/2, -grid_size/2,
        0, 0, 0,];
        let uv_coord = [
        0.0, 0.0,
        1.0, 0.0,
        0.5, 1.0,
        0.0, 0.0,
        1.0, 0.0,
        0.5, 1.0,
        0.0, 0.0,
        1.0, 0.0,
        0.5, 1.0,
        0.0, 0.0,
        1.0, 0.0,
        0.5, 1.0 ];
        for(var i=0; i<cone_coord.length; i++){
            vertices[i] = cone_coord[i];
        }
        for(var i=0; i<uvs.length; i++){
            uvs[i] = uv_coord[i];
        }
        for(var i=0; i<indices.length; i++){
            indices[i] = i;
        }

        /*indices[3*0+0] = 1;
        indices[3*0+1] = 2;
        indices[3*0+2] = 0;
        indices[3*1+0] = 2;
        indices[3*1+1] = 3;
        indices[3*1+2] = 0;
        indices[3*2+0] = 3;
        indices[3*2+1] = 4;
        indices[3*2+2] = 0;
        indices[3*3+0] = 4;
        indices[3*3+1] = 1;
        indices[3*3+2] = 0;*/

        geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
        geometry.setAttribute( 'uv',    new THREE.BufferAttribute( uvs,  2));
        geometry.setAttribute( 'index',    new THREE.BufferAttribute( indices,  1));
        geometry.computeVertexNormals();

        return geometry;
    }

    function mCreateCone(px, py, pz){    
        //let mat = new THREE.MeshLambertMaterial({color: 0x6699FF});
        let mat = new THREE.MeshLambertMaterial({map: buildTexture, side: THREE.DoubleSide});
        mat.transparent = true;
        mat.opacity = 1.0;

        let geometry = mCreateConeGeometry();
        //console.log("geometry:", geometry.attributes);
        let vertices = geometry.attributes.position.array;
        let indices = geometry.attributes.index.array;
        
        let coneMesh = new THREE.Mesh( geometry, mat );
        coneMesh.castShadow = true
        coneMesh.receiveShadow = true;
        coneMesh.buildType = 1;
        scene.add(coneMesh)
            const coneBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz))
            const coneShape = RAPIER.ColliderDesc.trimesh(vertices, indices).setMass(1).setRestitution(0.0).setFriction(0.0)
            const coneCollider = world.createCollider(coneShape, coneBody)
            coneCollider.build_id = build_id;
        ArrayMesh.push(coneMesh);
        ArrayBody.push(coneBody);

        mAddBuild(coneCollider, coneMesh, coneBody)
        build_id += 1; 
    }

    mCreateCone(grid_size*1+grid_size/2, gridH_size/2, grid_size/2);
    mCreateCone(grid_size*2+grid_size/2, gridH_size/2, grid_size/2);
    mCreateCone(grid_size*3+grid_size/2, gridH_size/2, grid_size/2);
    mCreateCone(grid_size*4+grid_size/2, gridH_size/2, grid_size/2);
    mCreateCone(grid_size*5+grid_size/2, gridH_size/2, grid_size/2);


    //--- Player
    let ArrayPlayerCollider = [];
    let playerBodyMesh = new THREE.Group();
        const playerBodyStandMesh = new THREE.Mesh(new THREE.CapsuleGeometry(playerRadius, playerRadius*3), new THREE.MeshBasicMaterial({color: 0x0000FF, wireframe: true}))
        playerBodyStandMesh.castShadow = false
        playerBodyMesh.add(playerBodyStandMesh);
            const playerBodySquatMesh = new THREE.Mesh(new THREE.CapsuleGeometry(playerRadius, playerRadius*1.5), new THREE.MeshBasicMaterial({color: 'red', wireframe: true}))
            playerBodySquatMesh.position.set(0, -playerRadius*0.75, 0);
            playerBodySquatMesh.castShadow = false
            playerBodySquatMesh.visible = false
            playerBodyMesh.add(playerBodySquatMesh)
        playerBodyMesh.visible = false;
    scene.add(playerBodyMesh)
    ArrayMesh.push(playerBodyMesh);

        const playerBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, playerRadius*5, 0).lockRotations())
        const playerShape = RAPIER.ColliderDesc.capsule(playerRadius*1.5, playerRadius).setMass(1).setRestitution(0.0).setFriction(2.0)
        playerShape.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        let playerCollider = world.createCollider(playerShape, playerBody);
        ArrayPlayerCollider.push(playerCollider);
        //console.log("playerCollider.handle:%o", playerCollider.handle)
        console.log("playerCollider.handle:", playerCollider)

        //const playerSquatBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, playerRadius*5, 0).lockRotations())
        const playerSquatShape = RAPIER.ColliderDesc.capsule(playerRadius*0.75, playerRadius).setMass(1.0).setTranslation(0.0, -playerRadius*0.75, 0.0).setRestitution(0.0).setFriction(2.0)
        playerSquatShape.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        let playerSquatCollider = world.createCollider(playerSquatShape, playerBody);
        playerSquatCollider.setEnabled(false);
        ArrayPlayerCollider.push(playerSquatCollider);

    ArrayBody.push(playerBody);
    //playerBody.setLinearDamping(1.0);

    let characterController = world.createCharacterController(0.01);
    characterController.enableSnapToGround(2);

    function mPlayerIsNotGrounded(){
        //console.log("mPlayerIsNotGrounded")
        if(playerBody && playerCollider){
            playerBody.setGravityScale(1/g_scale, true);
            playerCollider.setFriction(0.0)
        }
        
    }

    function mPlayerIsGrounded(){
        //console.log("mPlayerIsGrounded")
        
        if(playerBody && playerCollider){
            playerBody.setGravityScale(1.0, true);
            playerCollider.setFriction(2.0)
        }
        //if(mixer){
            arrayAction[5].stop();
            //if(!arrayAction[0].isRunning){
            //    arrayAction[0].play();    
            //}
        //}
    }

    //--- Key event ---//
    var keyEnabledArray = Array(222).fill(true);
    let movement = {'forward': false, 'back': false, 'left': false, 'right': false};
    let lastJumpTime = -1; //performance.now();

    $(document).on( 'keydown keyup', (event) => {  

        //console.log("key:"+ event.key)
        
        if(event.key === 'p'  && event.type === 'keydown'){
            if(document.pointerLockElement==null){ //(!mPointLock){
                //ElementRequestPointerLock(canvas2d);
                mEnablePointerLock(canvas2d);
            }
            else{
                DocumentExitPointerLock(document);
            }
        }
        
    
        const KeyToCommand = {
            'W': 'forward',
            'S': 'back',
            'A': 'left',
            'D': 'right',
        };
        const command = KeyToCommand[event.key.toUpperCase()];
        if(command){
            //console.log('command:'+ command +', '+ event.type)
            if(event.type === 'keydown'){
                movement[command] = true;
            }else{ /* keyup */
                movement[command] = false;    
            }
            //console.log('movement:%o', movement)
            
        }

        if(event.key === ' '  && event.type === 'keydown'){
            //console.log('space');
            
            if(c_player && c_player.isGrounded ){
                
                /*
                let vx = playerBody.linvel().x;
                let vy = playerBody.linvel().y;
                let vz = playerBody.linvel().z;
                //playerBody.setLinvel({ x: vx, y: 0, z: vz}, true);
                playerBody.applyImpulse({ x: vx, y: 6, z: vz }, true);
                //playerBody.applyImpulse({ x: 0.0, y: 6, z: 0.0 }, true);
                lastJumpTime = performance.now();
                c_player.isGrounded = false;
                mPlayerIsNotGrounded() */
                c_player.isJump = true;
            }
            
        }

        if(event.key === 'Shift'  && event.type === 'keydown'){
            if(c_player.slidingPressedTime < 0){
                c_player.slidingPressedTime = new Date().getTime();
                c_player.isSliding = false;
            }
            //c_player.isSliding = false;
            //console.log('c_player.slidingPressedTime:'+c_player.slidingPressedTime);
        }
        if(event.key === 'Shift'  && event.type === 'keyup'){
            //console.log('Shift');
            c_player.slidingPressedTime = -1;
            //console.log('c_player.isSliding:'+c_player.isSliding);
            if( !c_player.isSliding ){
                if(c_player && c_player.isGrounded ){
                    if(c_player.isCrouch){
                        c_player.isCrouch = false;
                        /*playerCollider.setEnabled(true)
                        playerSquatCollider.setEnabled(false)
                        playerBodyStandMesh.visible = true
                        playerBodySquatMesh.visible = false*/
                        mSetPlayerColliderCrouch(false)
                    }else{
                        c_player.isCrouch = true;
                        /*playerSquatCollider.setEnabled(true)
                        playerCollider.setEnabled(false)
                        playerBodyStandMesh.visible = false
                        playerBodySquatMesh.visible = true*/
                        mSetPlayerColliderCrouch(true)
                    }
                    //console.log('c_player.isCrouch:', c_player.isCrouch);
                }
            }else{
                c_player.isSliding = false;
            }
            
        }
    
        if(event.key.toUpperCase() === 'F'  && event.type === 'keydown'){
            if(c_player){
                c_player.mode = 1;
                c_player.weapon = 0;
                //weaponMesh.visible = true;
                c_player.buildTemp.visible = false;
                console.log('c_player.weapon:', c_player.weapon);
            }
        }
       
        /*if(event.key === '1'  && event.type === 'keydown'){
            if(c_player){
                c_player.weapon = 1;
                weaponMesh.visible = true;
                console.log('c_player.weapon:', c_player.weapon);
            }
        }*/

        if(event.key.toUpperCase() === 'Q'  && event.type === 'keydown'){
            mBuildModeWall()
        }

        if(event.key.toUpperCase() === 'Z'  && event.type === 'keydown'){
            mBuildModeFloor()
        }

        if(event.key.toUpperCase() === 'C'  && event.type === 'keydown'){
            mBuildModeSlope()
        }

        if(event.key.toUpperCase() === 'TAB'  && event.type === 'keydown'){
            mBuildModeCone()
        }

        if(keyEnabledArray[event.keyCode] && event.type === 'keydown') {
            keyEnabledArray[event.keyCode] = false;
            //console.log('keydown:'+event.keyCode+","+keyEnabledArray[event.keyCode])
        }
    
        if( event.type === 'keyup') {
            keyEnabledArray[event.keyCode] = true;
            //console.log('keyup:'+event.keyCode+","+keyEnabledArray[event.keyCode])
        }
    
    });

    function mSetPlayerColliderCrouch(isCrouch){
        //console.log("mSetPlayerColliderCrouch:",isCrouch)
        playerCollider.setEnabled(!isCrouch)
        playerSquatCollider.setEnabled(isCrouch)
        playerBodyStandMesh.visible = !isCrouch
        playerBodySquatMesh.visible = isCrouch
    }

    function mBuildModeWall(){
        if(c_player){
            c_player.mode = 2;
            c_player.buildType = 0;
            c_player.weapon = 0;
            weaponMesh.visible = false;
            //console.log('c_player.weapon:', c_player.weapon);
        }
    }

    function mBuildModeFloor(){
        if(c_player){
            c_player.mode = 2;
            c_player.buildType = 1;
            c_player.weapon = 0;
            weaponMesh.visible = false;
            //console.log('c_player.weapon:', c_player.weapon);
        }
    }

    function mBuildModeSlope(){
        if(c_player){
            c_player.mode = 2;
            c_player.buildType = 2;
            c_player.weapon = 0;
            weaponMesh.visible = false;
            //console.log('c_player.weapon:', c_player.weapon);
        }
    }
    
    function mBuildModeCone(){
        if(c_player){
            c_player.mode = 2;
            c_player.buildType = 3;
            c_player.weapon = 0;
            weaponMesh.visible = false;
            //console.log('c_player.weapon:', c_player.weapon);
        }
    }

    //--- Mouse event ---//
    var mMouseSenseX = 0.00065*2; //0.00065 at 10%
    var mMouseSenseY = 0.00065*2; //
    let c_player = new Object();
    c_player.model = null;
    c_player.angle_offset_init = 0; //Math.PI;
    c_player.angle_offset = c_player.angle_offset_init;
    c_player.angle = 0; //Math.PI;
    c_player.angle2 = 0;
    c_player.height = playerRadius * 5;
    c_player.isGrounded = false;
    c_player.isOnSlope = false;
    c_player.isJump = false;
    c_player.isCrouch = false;
    c_player.slidingPressedTime = -1;
    c_player.isSliding = false;
    c_player.weapon = 0;
    c_player.isFiring = false;
    c_player.lastFiringTime = -1;
    c_player.firingMesh = null;
    c_player.mode = 1; // 1:shoot, 2:build, 3:edit
    c_player.buildType = 0;
    c_player.buildTemp = null;
    c_player.zWallTemp = null;
    c_player.xWallTemp = null;
    c_player.FloorTemp = null;
    c_player.zSlopeTemp = null;
    c_player.xSlopeTemp = null;
    c_player.ConeTemp = null;

    //let buildTempMaterial = new THREE.MeshBasicMaterial({color: "white", side: THREE.DoubleSide});
    let buildTempMaterial = new THREE.MeshBasicMaterial({map: buildTempTexture, side: THREE.DoubleSide});
    buildTempMaterial.transparent = true;
    buildTempMaterial.opacity = 0.7;

    function mInitBuildTemp(player){
        let Lx = grid_size
        let Ly = gridH_size
        let Lz = buildThick
        const zWallMesh = new THREE.Mesh(new THREE.BoxGeometry(Lx, Ly, Lz), buildTempMaterial)
        zWallMesh.position.set(Lx/2, Ly/2, Lz/2);
        zWallMesh.visible = false;
        player.zWallTemp = zWallMesh;
        scene.add(player.zWallTemp);

        Lz = grid_size
        Lx = buildThick
        const xWallMesh = new THREE.Mesh(new THREE.BoxGeometry(Lx, Ly, Lz), buildTempMaterial)
        xWallMesh.position.set(Lx/2, Ly/2, Lz/2);
        xWallMesh.visible = false;
        player.xWallTemp = xWallMesh;
        scene.add(player.xWallTemp);

        Lz = grid_size
        Lx = grid_size
        Ly = buildThick
        const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(Lx, Ly, Lz), buildTempMaterial)
        floorMesh.position.set(Lx/2, Ly/2, Lz/2);
        floorMesh.visible = false;
        player.FloorTemp = floorMesh;
        scene.add(player.FloorTemp);

        let L = Math.sqrt(grid_size*grid_size+gridH_size*gridH_size)
        let a = Math.acos(grid_size/L)
        Lx = grid_size
        Ly = buildThick
        Lz = L
        const zSlopeMesh = new THREE.Mesh(new THREE.BoxGeometry(Lx, Ly, Lz), buildTempMaterial)
        zSlopeMesh.position.set(Lx/2, gridH_size/2, Lz/2);
        zSlopeMesh.rotation.x = -a;
        zSlopeMesh.visible = false;
        player.zSlopeTemp = zSlopeMesh;
        scene.add(player.zSlopeTemp);
        
        Lz = grid_size
        Ly = buildThick
        Lx = L
        const xSlopeMesh = new THREE.Mesh(new THREE.BoxGeometry(Lx, Ly, Lz), buildTempMaterial)
        xSlopeMesh.position.set(Lx/2, gridH_size/2, Lz/2);
        xSlopeMesh.rotation.z = a;
        xSlopeMesh.visible = false;
        player.xSlopeTemp = xSlopeMesh;
        scene.add(player.xSlopeTemp);

        let geometry = mCreateConeGeometry();
        const coneMesh = new THREE.Mesh( geometry, buildTempMaterial );
        coneMesh.position.set(grid_size/2, gridH_size/2, grid_size/2);
        coneMesh.visible = false;
        player.ConeTemp = coneMesh;
        scene.add(player.ConeTemp);

    }

    mInitBuildTemp(c_player);



    canvas2d.addEventListener('mousemove', function(e)
    {
        //console.log("mousemove:");
        
        if(c_player){

            var ang_ = (e.movementX) * mMouseSenseX * Math.PI/2;
            var ang2_ = (e.movementY) * mMouseSenseY * Math.PI/2;

            
            if(camera.zoom > 1 ){
                ang_ *= 0.5;
                ang2_ *= 0.5
            }
            

            //console.log("ang_:"+ang_);
            c_player.angle -= ang_;
            c_player.angle2 -= ang2_;
            if(c_player.angle >= Math.PI*2.0){
                c_player.angle -= Math.PI*2.0;
            }
            if(c_player.angle < 0){
                c_player.angle += Math.PI*2.0;
            }
            c_player.angle2 = Math.max(-Math.PI/2, c_player.angle2);
            c_player.angle2 = Math.min( Math.PI/2, c_player.angle2);
            //console.log("c_player.angle:"+c_player.angle/Math.PI*180);
            //console.log("c_player.angle2:"+c_player.angle2/Math.PI*180);
            //c_player.weaponMesh.rotation.x = -c_player.angle2;
            playerPiv1.rotation.x = -c_player.angle2;
            if(props.frontView){
                playerPiv1.rotation.x = c_player.angle2;
            }
        }
        
    });

    canvas2d.addEventListener('mousedown', function(e)
    {
        //console.log('mousedown')
        if(document.pointerLockElement==null){
            mEnablePointerLock(canvas2d)
        }

        if(c_player){

            if(c_player.mode==1){ //(mMode==1){
                if(e.button==0){
                    if((c_player.weapon!=5) ){ // (c_player.weapon<=3)   //(c_player.weapon<=4)||(c_player.weapon==6)
                        //movement['shoot'] = true;
                        //ws.send("shoot " + 1);
                        c_player.isFiring = true;
                        //c_player.lastFiringTime = -1;
                        //console.log("c_player.isFiring:"+c_player.isFiring);
                    }
                    
                }//    
                else if(e.button==2){
                    camera.zoom = 3; //1.001;
                    camera.updateProjectionMatrix();
                    c_player.model.visible = false;
                    c_player.weaponMesh.visible = true;
                }                
            }
            
            if(e.button==0){ 
                //mDoBuild(c_player.buildTemp)
                c_player.nowTouboBuild = true;
            }
           
            if( (e.button==2) ){
                //ws.send('scope '+ 1)
            }

        }//c_player

    });

    canvas2d.addEventListener('mouseup', function(e)
    {
        if(c_player){

            if(e.button==0){
                //movement['shoot'] = false;
                //socket.emit('movement', movement);
                //ws.send("shoot " + 0);
                c_player.isFiring = false;
                //c_player.lastFiringTime = new Date().getTime();
                //console.log("c_player.isFiring:"+c_player.isFiring);
                c_player.nowTouboBuild = false;
            }//

            if(e.button==2){
                camera.zoom = 1;
                camera.updateProjectionMatrix();
                //socket.emit('readyShoot', 0);
                c_player.model.visible = true;
                c_player.weaponMesh.visible = false;
            }

        }//
    });

    canvas2d.addEventListener('mousewheel', function(e)
    {
        var v_ = e.wheelDelta;
        if(v_<0){ // down(win)    up(mac)
            //console.log('wheel down:');  
            mBuildModeFloor()
        }else if(v_>0){ //up(win)  down(mac)
            mBuildModeSlope()
        }
        //console.log('wheel:'+v_);  
    });


    const gui = new GUI();
    props = {
        //showAxes: true,
        showCollision: false,
        showShadow: true,
        rayCast: false,
        hitSound: false,
        //pointerLock: false,
        frontView: false,
    };
    //gui.add( props, 'showAxes').name('Show axes')
    gui.add( props, 'showCollision').name('Show collision').onChange( value => {
        playerBodyMesh.visible = value;
      })
    gui.add( props, 'showShadow').name('Show shadow').onChange( value => {
        light.castShadow = value;
      })
    /*gui.add( props, 'pointerLock').name('Pointer lock').onChange( value => {
        if(value){
            mEnablePointerLock();
        }else{
            DocumentExitPointerLock(document);
        }
      })*/
    gui.add( props, 'rayCast').name('Ray cast').onChange( value => {
        
        })
    gui.add( props, 'hitSound').name('Hit sound').onChange( value => {
        
        })
    gui.add( props, 'frontView').name('Front View').onChange( value => {
        
        })

    const clock = new THREE.Clock();
    let delta
    let player_speed = mScale * 5; // [/ms]
    let last_game_time = new Date().getTime(); //[ms]
    let current_game_time = new Date().getTime(); //[ms]
    let playerLastPosition = new THREE.Vector3(0,0,0)
    let playerNewPosition = new THREE.Vector3(0,0,0)
    let playerMoveDirection = new THREE.Vector3(0,0,0)
    let playerPlaneMoveDistance = new THREE.Vector3(0,0,0)
    let t = 0;
    let lastGroundedTime = -1; //performance.now();
    let camera_dir = new THREE.Vector3();
    let eventQueue = new RAPIER.EventQueue(true);
    let ArrayHitMesh = new Array();

    let line_geo = new THREE.LineSegmentsGeometry();
    let matLine = new THREE.LineMaterial( {
        color: "orange", //0xffffff, does not work
        linewidth: 5, // in world units with size attenuation, pixels otherwise
        vertexColors: true,
        resolution,  // to be set by renderer, eventually
        dashed: false,
        alphaToCoverage: true,
    } );
    let node_vertices = [];
    let colors = [];
    colors.push( 255, 255, 255 );
    colors.push( 255, 255, 255 );

    function mSetPlayerAnimation(){

        if ( mixer ) {
            mixer.update( delta );

            /*if(c_player.weapon == 1){
                arrayAction[0].stop();
                arrayAction[6].stop();
                if(!c_player.isCrouch){
                    arrayAction[14].stop();
                    if(c_player.isFiring){
                        arrayAction[13].play();
                        //console.log('play')
                    }else{
                        arrayAction[13].play();
                        arrayAction[13].reset();
                    }
                }else{
                    let wx = mWeaponOffset.dx;
                    let wy = mWeaponOffset.dy;
                    let wz = mWeaponOffset.dz;
                    weaponMesh.position.set(wx,wy*0,wz);
                    arrayAction[13].stop();
                    if(c_player.isFiring){
                        arrayAction[14].play();
                    }else{
                        arrayAction[14].play();
                        arrayAction[14].reset();
                    }
                }

                return
            }else{
                arrayAction[13].stop();
                arrayAction[14].stop();
                //arrayAction[0].play();
                //arrayAction[13].reset();
            }*/

        
            if( c_player.isGrounded ){
                mPlayerIsGrounded()
                lastGroundedTime = current_game_time //currentTime
                if(arrayAction[5].isRunning()){
                    arrayAction[5].stop();
                }
            }else{
                if(arrayAction[0].isRunning()){
                    arrayAction[0].stop();
                }
                if(!arrayAction[5].isRunning()){
                    arrayAction[5].play();
                }
            }
    
            //console.log("c_player.isGrounded:"+c_player.isGrounded)
            //console.log("currentTime:" + currentTime +" lastGroundedTime:"+lastGroundedTime)
    
            
            if( (!movement.forward) && (!movement.back) && (!movement.left) && (!movement.right) ){
                if(!c_player.isCrouch){
                    if(arrayAction[6].isRunning()){
                        arrayAction[6].stop();
                    }
                    if(!arrayAction[0].isRunning()){
                        arrayAction[0].play();
                    }
                }else{
                    //console.log("crouch")
                    if(arrayAction[0].isRunning()){
                        arrayAction[0].stop();
                    }
                    if(!arrayAction[6].isRunning()){
                        arrayAction[6].play();
                    }
                }
            }else{
                arrayAction[0].stop();
                arrayAction[6].stop();
            }
    
            if(movement.forward){
                if(!c_player.isCrouch){
                    arrayAction[7].stop();
                    arrayAction[1].play();
                }else{
                    arrayAction[1].stop();
                    arrayAction[7].play();
                }
            }else{
                arrayAction[1].stop();
                arrayAction[7].stop();
            }
    
            if(movement.back){
                //arrayAction[2].play();
                if(!c_player.isCrouch){
                    arrayAction[8].stop();
                    arrayAction[2].play();
                }else{
                    arrayAction[2].stop();
                    arrayAction[8].play();
                }
            }else{
                arrayAction[2].stop();
                arrayAction[8].stop();
            }
    
            if( movement.left && !movement.forward && !movement.back){
                //arrayAction[3].play();
                if(!c_player.isCrouch){
                    arrayAction[9].stop();
                    arrayAction[3].play();
                }else{
                    arrayAction[3].stop();
                    arrayAction[9].play();
                }
            }else{
                arrayAction[3].stop();
                arrayAction[9].stop();
            }
    
            if( movement.right && !movement.forward && !movement.back){
                //arrayAction[4].play();
                if(!c_player.isCrouch){
                    arrayAction[10].stop();
                    arrayAction[4].play();
                }else{
                    arrayAction[4].stop();
                    arrayAction[10].play();
                }
            }else{
                arrayAction[4].stop();
                arrayAction[10].stop();
            }   
    
            //console.log('c_player.isSliding:'+c_player.isSliding);
            if( current_game_time > c_player.slidingPressedTime + 300 && c_player.slidingPressedTime > 0 ){
                if( !c_player.isSliding ){
                    console.log('sliding play');
                    mPlayAudioBuffer(mArrayAudio[3], 1, false);
                }
                c_player.isSliding = true;
                //c_player.slidingPressedTime = -1;
            }

    
            if(c_player.isSliding){
                //console.log('c_player.isSliding:'+c_player.isSliding);
                arrayAction[1].stop();
                if(!arrayAction[11].isRunning()){
                    arrayAction[11].play();
                }
                mSetPlayerColliderCrouch(true)
            }else{
                //console.log('c_player.isSliding:'+c_player.isSliding);
                arrayAction[11].stop();
                if(!c_player.isCrouch){
                    mSetPlayerColliderCrouch(false)
                }
                
            }
    
            
    
            //for(var i=0; i<arrayAction.length; i++){
            //    if(arrayAction[i]){
            //        console.log("arrayAction["+i+"]:"+arrayAction[i].isRunning() );
            //    }  
            //}
                
            }// mixer
    

    }

    tick();
    function tick() {
        stats.begin();

        if (world==null){
            return
        }
        //if ( mixer ){
        //}else{
        //    return
        //}
        
        delta = clock.getDelta()
        //if (world) {

        playerLastPosition.copy(playerNewPosition)

        //delta_world = clock.getDelta()
        world.timestep = Math.min(delta, 0.01)
        world.step(eventQueue)
        //console.log("delta:%o", delta)
        //console.log("world:%o", world)
        //console.log("d_world:"+dt_world)

        playerNewPosition.copy(playerBody.translation())

        for(var i = 0; i < ArrayMesh.length; i++){
            ArrayMesh[i].position.copy(ArrayBody[i].translation())
            ArrayMesh[i].quaternion.copy(ArrayBody[i].rotation())
        }
        
        playerMesh.position.copy(playerBody.translation())
        //playerMesh.quaternion.copy(playerBody.rotation())
        //console.log("sphereBody.position:%o", sphereBody.position)
        //console.log("playerBody.translation:%o", playerBody.translation())
        //console.log("playerBody.translation:%o", playerBody.translation().x)

        //playerMesh.position.copy(playerBody.position)
        //if( t%10 == 0){
        //  console.log("playerBody.position:%o", playerBody.position)
        //}

        //if( t%100 == 0){
            //c_player.isGrounded = false;
            //c_player.isOnSlope = false;
            
            eventQueue.drainContactForceEvents(event => {
                //console.log("event:")
                let handle1 = event.collider1(); // Handle of the first collider involved in the event.
                let handle2 = event.collider2(); // Handle of the second collider involved in the event.
                // Handle the contact force event. 
                //console.log("contact:%o, %o", handle1, handle2)
                //console.log("contact:%o", event.totalForce())
                let time_now = new Date().getTime(); //performance.now();
                for(var i = 0; i < ArrayPlayerCollider.length; i++){
                    let h = ArrayPlayerCollider[i].handle
                    //if(handle1==playerCollider.handle || handle2==playerCollider.handle){
                    if(handle1==h || handle2==h){
                        //console.log("contact:%o", event.totalForce())
                        if( Math.abs(event.totalForce().y) > 1 && time_now > lastJumpTime + 100  ){ // 
                            //lastGroundedTime = performance.now();
                            lastGroundedTime = time_now;
                            c_player.isGrounded = true;
                        
                            if( Math.abs(event.totalForce().x) > 1.0 || Math.abs(event.totalForce().z) > 1.0){
                                c_player.isOnSlope = true;
                            }else{
                                c_player.isOnSlope = false;
                            }
                        }
                    }
                } //i
                    
            });
            
            //console.log("c_player.isGrounded:", c_player.isGrounded)
            //console.log("c_player.isOnSlope:", c_player.isOnSlope)
        //}

        if(props.rayCast){
            //console.log("camera pos:", camera.position)
            //let camera_dir = new THREE.Vector3();
            camera.getWorldDirection(camera_dir)
            //console.log("camera dir:", camera_dir)

            let cp = camera.position;
            let ray = new RAPIER.Ray({ x: cp.x, y: cp.y, z: cp.z }, { x: camera_dir.x, y: camera_dir.y, z: camera_dir.z });
            let maxToi = grid_size*grid_num;
            let solid = false;

            let hit = world.castRay(ray, maxToi, solid);
            if (hit != null) {
                // The first collider hit has the handle `hit.colliderHandle` and it hit after
                // the ray travelled a distance equal to `ray.dir * toi`.
                let hitPoint = ray.pointAt(hit.timeOfImpact); // Same as: `ray.origin + ray.dir * toi`
                //console.log("Collider", hit.collider, "hit at point", hitPoint);
                //console.log("hit.timeOfImpact:", hit.timeOfImpact);
                if(hit.timeOfImpact >= mCameraOffset.dz){
                    const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(playerRadius*0.1), new THREE.MeshBasicMaterial({color: 'orange'}))
                    hitMesh.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
                    ArrayHitMesh.push(hitMesh);
                    scene.add(hitMesh)
                    if(ArrayHitMesh.length>100){
                        let delMesh = ArrayHitMesh[0];
                        scene.remove(delMesh);
                        ArrayHitMesh.shift();
                    }
                    if(props.hitSound){
                        mPlayAudioBuffer(mArrayAudio[0]);
                    }

                }//
            }
        }//

        //}

        current_game_time = new Date().getTime();
        let dt = current_game_time - last_game_time;
        //console.log("dt:"+dt);
        last_game_time = current_game_time;

        t += 1;
          
        
        mSetPlayerAnimation()


        if (playerMesh != null){

            if( playerBody.translation().y < -gridH_size ){ // init
                playerBody.setTranslation({ x: 0.0, y: gridH_size, z: 1.0 }, true)
            }
    
            if(current_game_time > lastGroundedTime + 10  ){ // Fall
                //console.log("Fall:")
                c_player.isGrounded = false;
                c_player.isOnSlope = false;
                mPlayerIsNotGrounded()
            }    

            if(c_player.isJump){
                //console.log('jump');
                c_player.isGrounded = false;
                c_player.isOnSlope = false;
                mPlayerIsNotGrounded()
                let vx = playerBody.linvel().x;
                let vy = playerBody.linvel().y;
                let vz = playerBody.linvel().z;
                //playerBody.setLinvel({ x: vx, y: 0, z: vz}, true);
                //playerBody.applyImpulse({ x: vx, y: 6, z: vz }, true);
                playerBody.applyImpulse({ x: 0.0, y: 6, z: 0.0 }, true);
                lastJumpTime = new Date().getTime(); // performance.now();
                
                c_player.isJump = false;
            }
            
            let move_num = movement.forward + movement.back + movement.left + movement.right;
                //console.log("move_num:"+move_num);
            let dis = player_speed * dt;
            let spd = player_speed;
            if(move_num == 2){
                dis /= Math.sqrt(2);
                spd /= Math.sqrt(2);
            }else if(move_num==0){
                spd = 0;
            }

            if(c_player.isCrouch){
                spd /= 2;
            }

            
            let a1 = c_player.angle;
            let s = playerBody.linvel();
            //console.log("playerBody.linvel():%o", playerBody.linvel());

            if(s.y < -10){
                playerBody.setLinvel({ x: s.x, y: -10, z: s.z}, true);
                s = playerBody.linvel();
            }

            let input_sx = 0;
            let input_sz = 0;
            if(movement.forward){
                input_sz += spd * Math.cos(a1);
                input_sx += spd * Math.sin(a1);
            }
            if(movement.back){
                input_sz += -spd * Math.cos(a1);
                input_sx += -spd * Math.sin(a1);
            }
            if(movement.left){
                input_sx +=  spd * Math.cos(a1);
                input_sz += -spd * Math.sin(a1);
            }
            if(movement.right){
                input_sx += -spd * Math.cos(a1);
                input_sz +=  spd * Math.sin(a1);
            }

            if(c_player.isGrounded){
                //console.log('input');
                playerBody.setLinvel({ x: input_sx, y: s.y, z: input_sz}, true);

                let ctr_collider = playerCollider;
                let desiredTranslation = new RAPIER.Vector3(input_sx*delta, s.y*delta, input_sz*delta);
                let characterController = world.createCharacterController(0.0);
                characterController.setMaxSlopeClimbAngle(45 * Math.PI / 180);
                //characterController.enableSnapToGround(0.001);
                characterController.computeColliderMovement(
                    ctr_collider,    // The collider we would like to move.
                    desiredTranslation, // The movement we would like to apply if there wasn’t any obstacle.
                );
                // Read the result.
                let correctedMovement = characterController.computedMovement();
                //console.log("correctedMovement:", correctedMovement);
                //console.log("correctedMovement:", correctedMovement.x);
                if(delta>0){
                    //console.log("correctedMovement:", correctedMovement);
                    //console.log("correctedVel:", correctedMovement.z/delta);
                    playerBody.setLinvel({ x: correctedMovement.x/delta, y: correctedMovement.y/delta, z: correctedMovement.z/delta}, true);
                }

            }else{
                let s2x = s.x + input_sx*delta;
                let s2z = s.z + input_sz*delta;
                let s2_mag = Math.sqrt(s2x*s2x+s2z*s2z);
                let sc = 1.0;
                if(s2_mag > player_speed){
                    sc = player_speed / s2_mag;
                    s2x *= sc;
                    s2z *= sc;
                }
                playerBody.setLinvel({ x: s2x, y: s.y, z: s2z}, true);
            }


            c_player.angle_offset = c_player.angle_offset_init;
            if(c_player.model){
                c_player.model.rotation.y = 0;
            }
            
            if(movement.forward && movement.right){
                //c_player.angle_offset = c_player.angle_offset_init + Math.PI/4;
                c_player.model.rotation.y =  -Math.PI/4;
            }else if(movement.forward && movement.left){
                //c_player.angle_offset = c_player.angle_offset_init - Math.PI/4;
                c_player.model.rotation.y =  Math.PI/4;
            }else if(movement.back && movement.right){
                //c_player.angle_offset = c_player.angle_offset_init - Math.PI/4;
                c_player.model.rotation.y =  Math.PI/4;
            }else if(movement.back && movement.left){
                //c_player.angle_offset = c_player.angle_offset_init + Math.PI/4;
                c_player.model.rotation.y =  -Math.PI/4;
            }

            playerMesh.rotation.y = c_player.angle - c_player.angle_offset;

            /*if(c_player.model && c_player.weapon==1 && !c_player.isCrouch){
                let ang2 = c_player.angle2;
                c_player.model.traverse(function(obj) {
                    if(obj.name == "mixamorigSpine"){
                        //console.log("obj.name:" + obj.name)
                            obj.rotation.x = -ang2;
                            //obj.rotation.y = props[Array_v[i*3+1]]/180*3.1415;
                            //obj.rotation.z = props[Array_v[i*3+2]]/180*3.1415;
                    }
                })

            };*/

            if( c_player.mode == 1 && c_player.isFiring && current_game_time > c_player.lastFiringTime + 100){
                mPlayAudioBuffer(mArrayAudio[1])
                c_player.lastFiringTime = new Date().getTime();

                camera.getWorldDirection(camera_dir)
                //console.log("camera dir:", camera_dir)

                node_vertices = [];
                if(camera.zoom > 1){
                    let wp = muzzlePos.getWorldPosition(new THREE.Vector3());
                    node_vertices.push(wp.x, 
                        wp.y, 
                        wp.z);
                }else{
                    node_vertices.push(playerMesh.position.x, 
                        playerMesh.position.y + mCameraOffset.dy * (0.95 -  0.65*(c_player.isCrouch || c_player.isSliding) ), 
                        playerMesh.position.z);
                }
                

                /*let cp = camera.position;
                let ray = new RAPIER.Ray({ x: cp.x, y: cp.y, z: cp.z }, { x: camera_dir.x, y: camera_dir.y, z: camera_dir.z });
                let maxToi = grid_size*grid_num*2;
                let solid = false;
                let hit = world.castRay(ray, maxToi, solid);*/
                //let {hit, ray} = mPlayerRayHit(camera);
                let {hit, ray} = mPlayerRayHit(playerPiv1);

                let hitPoint;
                if (hit != null) {
                    hitPoint = ray.pointAt(hit.timeOfImpact); // Same as: `ray.origin + ray.dir * toi`
                    //console.log("Collider", hit.collider, "hit at point", hitPoint);
                    console.log("hit.timeOfImpact:", hit.timeOfImpact);
                    if(hit.timeOfImpact >= 0 ){  //mCameraOffset.dz
                        const hitMesh = new THREE.Mesh(new THREE.SphereGeometry(playerRadius*0.1), new THREE.MeshBasicMaterial({color: 'orange'}))
                        hitMesh.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
                        ArrayHitMesh.push(hitMesh);
                        scene.add(hitMesh)
                        if(ArrayHitMesh.length>100){
                            let delMesh = ArrayHitMesh[0];
                            scene.remove(delMesh);
                            ArrayHitMesh.shift();
                        }
                        mPlayAudioBuffer(mArrayAudio[0]);
                        node_vertices.push(hitPoint.x, hitPoint.y, hitPoint.z);
                        mBuildDamage(hit);
                    }else{

                    }

                }else{
                    let p0 = camera.position;
                    let d = camera_dir; 
                    let L = grid_size * grid_num;
                    //console.log("L:", L);
                    node_vertices.push(p0.x + d.x * L, p0.y + d.y * L, p0.z + d.z * L);
                }
                
                if(node_vertices.length > 3){
                    mCreateFiringMesh(node_vertices)
                }      
                weaponMesh.position.y = mWeaponOffset.dy *0.99;
                weaponMesh.position.z = mWeaponOffset.dz *1.05;
                //console.log("weaponMesh:", weaponMesh)
                //console.log("weaponMesh:", weaponMesh.getWorldPosition(new THREE.Vector3()))
            }

            if( current_game_time > c_player.lastFiringTime + 50){
                if(c_player.firingMesh!=null){
                    scene.remove(c_player.firingMesh);
                    c_player.firingMesh = null;
                }
                weaponMesh.position.y = mWeaponOffset.dy;
                weaponMesh.position.z = mWeaponOffset.dz;
            }


            //--- Build ---//
            if(c_player.mode == 2){
                mSetBuildTemp(c_player);

                if(c_player.buildTemp){
                    mDrawBuildTemp(c_player.buildTemp)
                }

                if(c_player.nowTouboBuild){
                    mDoBuild(c_player.buildTemp)
                }
            }
            
            //console.log("ArrayBuild:%o", ArrayBuild)


            mSetCameraPosition(camera, mCameraOffset, c_player); //playerMesh
            light.position.set(light_pos0.x + playerNewPosition.x, 
                               light_pos0.y + playerNewPosition.y, 
                               light_pos0.z + playerNewPosition.z);
 
        }
        renderer.render(scene, camera);
        requestAnimationFrame(tick);

        stats.end();
    }

    function mPlayerRayHit(piv_, sign_=1){
        let dir = new THREE.Vector3();
        piv_.getWorldDirection(dir)
        //let cp = camera_.position;
        let cp = piv_.getWorldPosition(new THREE.Vector3());
        let ray = new RAPIER.Ray({ x: cp.x, y: cp.y, z: cp.z }, 
                                 { x: dir.x*sign_, y: dir.y*sign_, z: dir.z*sign_ });
        let maxToi = grid_size*grid_num*2;
        let solid = false;
        let hit = world.castRay(ray, maxToi, solid);
        return {hit: hit, ray: ray};
    }

    function mCreateFiringMesh(vertices){
        line_geo.setPositions( vertices );
        line_geo.setColors( colors );
        //let line = new THREE.LineSegments2( line_geo, matLine );
        //line.computeLineDistances();
        //scene.add( line );
        c_player.firingMesh = new THREE.LineSegments2( line_geo, matLine );
        c_player.firingMesh.computeLineDistances();
        scene.add( c_player.firingMesh );
    }

    function mBuildDamage(hit){
        //console.log("Collider:", hit.collider)
        //let b = ArrayBuild[hit.collider.handle];
        let b = ArrayBuild[hit.collider.build_id];
        //console.log("b:%o", b);
        if(b!=null){
            //console.log("ArrayBuild:%o", ArrayBuild);
            b.health -= 30;
            //b.buildMesh.material.opacity = b.health / b.maxHealth * 0.5 + 0.5;
            b.buildMesh.material.opacity = b.health / b.maxHealth * 0.7 + 0.3;;
            //console.log("b.buildMesh.material.opacity:%o", b.buildMesh.material.opacity);
            if(b.health<=0){
                //b.buildMesh.material.opacity = 1;
                mDestroyBuild(b);
            }
        }
    }

    function mDestroyBuild(b){
        if(b!=null){
            scene.remove(b.buildMesh);
            b.buildMesh = null;
            world.removeCollider(b.collider);
            mPlayAudioBuffer(mArrayAudio[2], 2.0);

            //ArrayBuild.slice(i, 1)
            delete ArrayBuild[b.build_id]
        }
    }


    function mSetBuildTemp(player){

        player.zWallTemp.visible = false;
        player.xWallTemp.visible = false;
        player.FloorTemp.visible = false;
        player.zSlopeTemp.visible = false;
        player.xSlopeTemp.visible = false;
        player.ConeTemp.visible = false;

        if(player.buildType == 0){
            mWallTemp(player) 
        }else if(player.buildType == 1){
            mFloorTemp(player) 
        }else if(player.buildType == 2){
            mSlopeTemp(player) 
        }else if(player.buildType == 3){
            mConeTemp(player) 
        }

        player.buildTemp.buildType = player.buildType;
    }

    function mFloorGS(v_){ //floor to grid size
        return Math.floor(v_/grid_size) * grid_size;
    }

    function mFloorGSH(v_){ //floor to grid size
        return Math.floor(v_/gridH_size) * gridH_size;
    }
    
    function mWallTemp(player){

        //--- Z-X plane 
        let angleType_ = Math.floor( (player.angle+Math.PI/4.0) / (Math.PI/2.0) );
        angleType_ = angleType_ % 4;
        let angle_ = angleType_ * Math.PI/2;
        //console.log("angleType_:", angleType_);
        //console.log("player:", player.playerMesh.position);

        player.z = player.playerMesh.position.z;
        player.x = player.playerMesh.position.x;
        player.y = player.playerMesh.position.y;
        
        let z_ = mFloorGS(player.z);
        let x_ = mFloorGS(player.x);
        let y_ = mFloorGSH(player.y);
        let dy_ =  player.y - y_;
        //console.log("z_, x_, y_:", [z_, x_, y_]);

        let ty_ = Math.min(Math.tan(player.angle2),2.0);
        let ry_ = dy_ + grid_size/2.0*ty_;
        //console.log('ty_:'+ty_);
        
        if( ry_ >= gridH_size/2.0 ){
            y_ += gridH_size;
        }else if( ( ry_ <= -gridH_size/2.0 ) && ( ry_ >= -gridH_size) )  {
            y_ -= gridH_size;
        }
        y_ = Math.max(y_, 0)
        
        if( angleType_ == 0 ){
            z_ += grid_size;
            if( (player.z >= z_ - grid_size*0.15) && (player.angle2 >= -Math.PI/4.0) ){ //far
                z_ += grid_size;          
            }

            if( player.x + (z_-player.z)*Math.tan(player.angle-angle_) >= x_ + grid_size  ){ //far side
                x_ += grid_size;
            }else if( player.x - (z_-player.z)*Math.tan(angle_-player.angle) <= x_  ){ //far side
                x_ -= grid_size;
            }
            
            x_ += grid_size/2;
            y_ += gridH_size/2;

            player.zWallTemp.position.set(x_, y_, z_);
            player.buildTemp = player.zWallTemp;

        }else if( angleType_ == 2 ){
            if( (player.z <= z_ + grid_size*0.15) && (player.angle2 >= -Math.PI/4.0 ) ){ //far
                z_ -= grid_size;          
            }
    
            if( player.x + (player.z-z_)*Math.tan(angle_-player.angle) >= x_ + grid_size  ){ //far side
                x_ += grid_size;
            }else if( player.x - (player.z-z_)*Math.tan(player.angle-angle_) <= x_  ){ //far side
                x_ -= grid_size;
            }
            
            x_ += grid_size/2;
            y_ += gridH_size/2;

            player.zWallTemp.position.set(x_, y_, z_);
            player.buildTemp = player.zWallTemp;

        }else if( angleType_ == 1 ) {

            x_ += grid_size;
            if( (player.x >= x_ - grid_size*0.15) && (player.angle2 >= -Math.PI/4.0) ){ //far
                x_ += grid_size;          
            }
    
            if( player.z + (x_-player.x)*Math.tan(angle_-player.angle) >= z_ + grid_size  ){ //far side
                z_ += grid_size;
            }else if( player.z - (x_-player.x)*Math.tan(player.angle - angle_) <= z_  ){ //far side
                z_ -= grid_size;
            }
            
            z_ += grid_size/2;
            y_ += gridH_size/2;

            player.xWallTemp.position.set(x_, y_, z_);
            //player.xWallTemp.visible = true;
            player.buildTemp = player.xWallTemp;
    
        } else if( angleType_ == 3 ) {
            if( (player.x<=x_ + grid_size*0.15) && (player.angle2 >= -Math.PI/4.0) ){
                x_ -= grid_size;          
            }

            if( player.z + (player.x-x_)*Math.tan(player.angle-angle_) >= z_ + grid_size  ){ //far side
                z_ += grid_size;
            }else if( player.z - (player.x-x_)*Math.tan(angle_-player.angle) <= z_  ){ //far side
                z_ -= grid_size;
            }
            
            /*if( player.x + (player.y-y_)*Math.tan(player.angle-angle_) >= x_ + mFieldGridSize  ){ //far side
                x_ += mFieldGridSize;
            }else if( player.x - (player.y-y_)*Math.tan(angle_-player.angle) <= x_  ){ //far side
                x_ -= mFieldGridSize;
            }*/

            z_ += grid_size/2;
            y_ += gridH_size/2;

            player.xWallTemp.position.set(x_, y_, z_);
            //player.xWallTemp.visible = true;
            player.buildTemp = player.xWallTemp;
            
        }
        //console.log("z_, x_, y_:", [z_, x_, y_]);

        player.buildTemp.angleType = angleType_;
    }

    function mFloorTemp(player){ 
        //console.log("mFloorTemp:");

        let x_ = player.playerMesh.position.x;
        let y_ = player.playerMesh.position.y;
        let z_ = player.playerMesh.position.z;
    
        let angle_ = player.angle
        let angle2_ = player.angle2
        let gz_ = mFloorGS(z_);
        let gx_ = mFloorGS(x_);
        let gy_ = mFloorGSH(y_); //+ mWallSizeH*0.2
        
        let ax_ = 0.0;
        let ay_ = 0.0;
        let az_ = 0.0;
    
        let l_ = 0.0;
        if(angle2_ != 0.0){
            l_ = player.height / Math.tan( Math.abs(angle2_) )
        }
        
        let add_z = [1,1,0,-1,-1,-1,0,1];
        let add_x = [0,1,1,1,0,-1,-1,-1];
        let d_angle_ = angle_ + Math.PI/8.0
        if(d_angle_ > 2.0*Math.PI){
            d_angle_ -= 2.0*Math.PI
        }

        for(var i = 0; i < 8; i++ ){
            if( ( d_angle_ >= Math.PI/4.0*i ) &&
                ( d_angle_ <= Math.PI/4.0*( i+1 ) ) ){
                
                if( add_z[i] != 0 ){
                    let qz_ = l_ * Math.cos(angle_)
                    
                    if( (add_z[i] > 0) && (z_ - gz_ >= grid_size*0.5) ){
                        if( qz_ >= grid_size*0.5 ){
                            az_ = grid_size;
                        }
                    } else if ( (add_z[i] < 0) && (z_ - gz_ <= grid_size*0.5) ){
                        if( z_ + qz_ <=  gz_ ){
                            az_ = -grid_size;
                        }
                    }
                }
    
                if( add_x[i] != 0 ){
                    let qx_ = l_ * Math.sin(angle_)
                    //fmt.Println("qx:", qx_)
                    if( (add_x[i] > 0) && (x_ - gx_ >= grid_size*0.5) ){
                        if( qx_ >= grid_size*0.5 ){
                            ax_ =grid_size;
                        }
                    } else if ( (add_x[i] < 0) && (x_ - gx_ <= grid_size*0.5) ){
                        if( x_ + qx_ <=  gx_ ){
                            ax_ = -grid_size;
                        }
                    }
                }
    
                if(angle2_ > 0){
                    ay_ = gridH_size;
                }
    
                break;
            }//
        }//
    
        gz_ += grid_size*0.5;
        gx_ += grid_size*0.5;
        //console.log("pos:", [gx_ + ax_, gy_ + ay_, gz_ + az_]);
        
        player.FloorTemp.position.set(gx_ + ax_, gy_ + ay_, gz_ + az_);
        player.buildTemp = player.FloorTemp;
    }
    
    function mSlopeTemp(player){

        //--- Z-X plane 
        let angleType_ = Math.floor( (player.angle+Math.PI/4.0) / (Math.PI/2.0) );
        angleType_ = angleType_ % 4;
        let angle_ = angleType_ * Math.PI/2;
        //console.log('angleType_:'+angleType_);

        player.z = player.playerMesh.position.z;
        player.x = player.playerMesh.position.x;
        player.y = player.playerMesh.position.y;
        
        let z_ = mFloorGS(player.z);
        let x_ = mFloorGS(player.x);
        let y_ = mFloorGSH(player.y);
        let dy_ =  player.y - y_;
        
        let ty_ = Math.min(Math.tan(player.angle2),2.0);
        let ry_ = dy_ + grid_size/2.0*ty_;
        //console.log('ty_:'+ty_);
        
        if( ry_ >= gridH_size/2.0 ){
            y_ += gridH_size;
        }else if( ( ry_ <= -gridH_size/2.0 ) && ( ry_ >= -gridH_size) )  {
            y_ -= gridH_size;
        }
        y_ = Math.max(y_, 0)
        //console.log('y_:'+y_);
    
        z_ += grid_size * Math.cos(angleType_*Math.PI/2);
        x_ += grid_size * Math.sin(angleType_*Math.PI/2);
        z_ = Math.round(z_)
        x_ = Math.round(x_)
        
        if( (player.angle2 < -Math.PI/4) ){
            z_ = mFloorGS(player.z);
            x_ = mFloorGS(player.x);
        }
        //console.log("z_, x_, y_:", [z_, x_, y_]);
    
        
        if( angleType_ == 0 ){
    
            if( player.x + (z_-player.z)*Math.tan(player.angle-angle_) >= x_ + grid_size  ){ //far side
                x_ += grid_size;
            }else if( player.x - (z_-player.z)*Math.tan(angle_-player.angle) <= x_  ){ //far side
                x_ -= grid_size;
            }
            player.zSlopeTemp.rotation.x = -slope_ang;
            player.buildTemp = player.zSlopeTemp;
            
        }else if( angleType_ == 2 ){
    
            if( player.x + (player.z-z_)*Math.tan(angle_-player.angle) >= x_ + grid_size  ){ //far side
                x_ += grid_size;
            }else if( player.x - (player.z-z_)*Math.tan(player.angle-angle_) <= x_  ){ //far side
                x_ -= grid_size;
            }
            player.zSlopeTemp.rotation.x = slope_ang;
            player.buildTemp = player.zSlopeTemp;
            
        }else if( angleType_ == 1 ) {
    
            if( player.z + (x_-player.x)*Math.tan(angle_-player.angle) >= z_ + grid_size  ){ //far side
                z_ += grid_size;
            }else if( player.z - (x_-player.x)*Math.tan(player.angle - angle_) <= z_  ){ //far side
                z_ -= grid_size;
            }
            
            player.xSlopeTemp.rotation.z = slope_ang;
            player.buildTemp = player.xSlopeTemp;
    
        } else if( angleType_ == 3 ) {
    
            if( player.z + (player.x-x_)*Math.tan(player.angle-angle_) >= z_ + grid_size  ){ //far side
                z_ += grid_size;
            }else if( player.z - (player.x-x_)*Math.tan(angle_-player.angle) <= z_  ){ //far side
                z_ -= grid_size;
            }
            
            player.xSlopeTemp.rotation.z = -slope_ang;
            player.buildTemp = player.xSlopeTemp;
    
        }
    
        z_ += grid_size/2;
        x_ += grid_size/2;
        y_ += gridH_size/2;

        player.buildTemp.angleType = angleType_;
        player.buildTemp.position.set(x_, y_, z_);
    
    }

    function mConeTemp(player){ 

        let x_ = player.playerMesh.position.x;
        let y_ = player.playerMesh.position.y;
        let z_ = player.playerMesh.position.z;
    
        let angle_ = player.angle
        let angle2_ = player.angle2
        let gz_ = mFloorGS(z_);
        let gx_ = mFloorGS(x_);
        let gy_ = mFloorGSH(y_); //+ mWallSizeH*0.2
        
        let ax_ = 0.0;
        let ay_ = 0.0;
        let az_ = 0.0;
    
        let l_ = 0.0;
        let l2_ = 0.0; // for low position
        let flag_low = 0;
        if(angle2_ != 0.0){
            l_ = player.height / Math.tan( Math.abs(angle2_) )
            l2_ = (player.height+grid_size) / Math.tan( Math.abs(angle2_) )
        }
    
        let add_z = [1,1,0,-1,-1,-1,0,1];
        let add_x = [0,1,1,1,0,-1,-1,-1];
        let d_angle_ = angle_ + Math.PI/8.0
        if(d_angle_ > 2.0*Math.PI){
            d_angle_ -= 2.0*Math.PI
        }

        for(var i = 0; i < 8; i++ ){
            if( ( d_angle_ >= Math.PI/4.0*i ) &&
                ( d_angle_ <= Math.PI/4.0*( i+1 ) ) ){
                
                if( add_z[i] != 0 ){
                    let qz_ = l_ * Math.cos(angle_)
                    let qz2_ = l2_ * Math.cos(angle_)
                    let dlow_ = z_-gz_+qz2_;
                    
                    if( (add_z[i] > 0) && (z_ - gz_ >= grid_size*0.5) ){
                        if( qz_ >= grid_size*0.5 ){
                            az_ = grid_size;
                        }                
                        if( (dlow_ > grid_size) && (dlow_<2.0*grid_size) ){
                            az_ = grid_size;
                            flag_low = 1
                        }else{
                            flag_low = 0
                        }
                    } else if ( (add_z[i] < 0) && (z_ - gz_ <= grid_size*0.5) ){
                        if( z_ + qz_ <=  gz_ ){
                            az_ = -grid_size;
                        }
                        if( (dlow_ < 0) && (dlow_ > -1.0*grid_size) ){
                            az_ = -grid_size;
                            flag_low = 1
                        }else{
                            flag_low = 0
                        }
                    }
                }
    
                if( add_x[i] != 0 ){
                    let qx_ = l_ * Math.sin(angle_)
                    let qx2_ = l2_ * Math.sin(angle_)
                    let dlow_ = x_-gx_+qx2_;
                    
                    if( (add_x[i] > 0) && (x_ - gx_ >= grid_size*0.5) ){
                        if( qx_ >= grid_size*0.5 ){
                            ax_ = grid_size;
                        }
    
                        if( (dlow_ > grid_size) && (dlow_<2.0*grid_size) ){
                            ax_ = grid_size;
                            flag_low = 1
                        }else{
                            flag_low = 0
                        }
                    } else if ( (add_x[i] < 0) && (x_ - gx_ <= grid_size*0.5) ){
                        if( x_ + qx_ <=  gx_ ){
                            ax_ = -grid_size;
                        }
                        if( (dlow_ < 0) && (dlow_ > -1.0*grid_size) ){
                            ax_ = -grid_size;
                            flag_low = 1
                        }else{
                            flag_low = 0
                        }
                    }
                }
    
                if(angle2_ > 0){
                    ay_ = gridH_size;
                } else {
                    if(flag_low==1){
                        ay_ = -gridH_size;
                    }
                }
    
                break;
            }//
        }//
        
        gz_ += grid_size*0.5;
        gx_ += grid_size*0.5;
        gy_ += gridH_size*0.5;
        //console.log("pos:", [gx_ + ax_, gy_ + ay_, gz_ + az_]);
        
        player.ConeTemp.position.set(gx_ + ax_, gy_ + ay_, gz_ + az_);
        player.buildTemp = player.ConeTemp;

    }
    

    function mCheckBuildIsUnique(build){
        let judge = true;

        /*for(var i = 0; i < ArrayBuild.length; i++){
            let b = ArrayBuild[i].buildMesh; 
            if(b==null){
                continue
            }
            if(b.buildType == build.buildType &&
                b.position.x == build.position.x && b.position.y == build.position.y &&  b.position.z == build.position.z ){
                    judge = false;
                    break
                    //return judge;
            }
        }*/
        //let n = 0;
        Object.values(ArrayBuild).forEach((v) => {
            //n += 1;
            if(v!=null && v.buildMesh!=null){
                let b = v.buildMesh;
                //console.log("b:", b.buildType);  
                if( b.position.x == build.position.x && b.position.y == build.position.y &&  b.position.z == build.position.z ){
                    //b.buildType == build.buildType &&
                        judge = false;
                        //console.log("b:", b);  
                        //break
                        return judge;
                }
            }
            
        })
        //console.log("mCheckBuildIsUnique:", judge);
        //console.log("n:", n);
        //console.log("n:", Object.keys(ArrayBuild).length);
        return judge;
    }

    function mDrawBuildTemp(build){
        console.log("mCheckBuildIsUnique:", mCheckBuildIsUnique(build));
        if( mCheckBuildIsUnique(build) ){
            build.visible = true;
        }        
    }

    function mDoBuild(build){
        if( !build.visible ){
            return;
        }

        if( build.buildType == 0 ){
            let px = build.position.x;
            let py = build.position.y;
            let pz = build.position.z;
            let type = "z"
            if( build.angleType==1 || build.angleType==3 ){
                type = "x"
            }
            mCreateWall(px, py, pz, type);
        }else if( build.buildType == 1 ){
            let px = build.position.x;
            let py = build.position.y;
            let pz = build.position.z;
            mCreateFloor(px, py, pz);
        }else if( build.buildType == 2 ){
            let px = build.position.x;
            let py = build.position.y;
            let pz = build.position.z;
            let type = "z+"
            if(build.angleType==1){
                type = "x+"
            }else if(build.angleType==2){
                type = "z-"
            }else if(build.angleType==3){
                type = "x-"
            }
            mCreateSlope(px, py, pz, type);
        }else if( build.buildType == 3 ){
            let px = build.position.x;
            let py = build.position.y;
            let pz = build.position.z;
            mCreateCone(px, py, pz);
        }
        mPlayAudioBuffer(mArrayAudio[4])

    }
    

    onResize();
    window.addEventListener('resize', onResize);
    function onResize() {
        width = document.getElementById('main_canvas').getBoundingClientRect().width;
        height = document.getElementById('main_canvas').getBoundingClientRect().height;

        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);

        renderer.getSize(resolution);

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        //console.log(width);

        mDraw2Dcontext()
    }

    //Pointer lock
    //let mPointLock = false;
    function ElementRequestPointerLock(element){
        //mPointLock = true;
        var list = [
            "requestPointerLock",
            "webkitRequestPointerLock",
            "mozRequestPointerLock"
        ];
        var i;
        var num = list.length;
        for(i=0;i < num;i++){
            if(element[list[i]]){
                element[list[i]]();
                return true;
            }
        }
        return false;
    }

    function DocumentExitPointerLock(document_obj){
        //mPointLock = false;
        var list = [
            "exitPointerLock",
            "webkitExitPointerLock",
            "mozExitPointerLock"
        ];
        var i;
        var num = list.length;
        for(i=0;i < num;i++){
            if(document_obj[list[i]]){
                document_obj[list[i]]();
                return true;
            }
        }
        return false;
    }

    function mEnablePointerLock(canvas_){
        setTimeout(() => {
            ElementRequestPointerLock(canvas_); //->needs action to enable pointer lock
        }, 1000);
    }
    
    //---Description
    function mDraw2Dcontext(){
        //const canvas2d = document.querySelector( '#canvas-2d' );
        var W_ = canvas2d.width;
        var H_ = canvas2d.height;
        console.log("canvas2d:"+W_+", "+H_)
        canvas2d.setAttribute("width", width);
        canvas2d.setAttribute("height", height);
        W_ = canvas2d.width;
        H_ = canvas2d.height;
        console.log("canvas2d:"+W_+", "+H_)

        const context2d = canvas2d.getContext('2d');
        let fontSize = W_/100;
        context2d.font = fontSize + 'px Bold Arial';
        context2d.fillStyle = "white"
        //context2d.textAlign = "center"
        /*context2d.fillText(
            "Click view: pointer lock,  WASD: move,  Space: jump,  Shift: crouch,  Shift(long): slide",
            W_/2, fontSize);
        context2d.fillText(
            "Mouse move: player's view direction, Left click: shoot, Right click: ADS",
            W_/2, fontSize*2);  
        context2d.fillText(
            "F: weapon mode, Q: wall, Z or wheel down: floor, C or wheel up: slope",
            W_/2, fontSize*3); */
        let array_string = [
            "Click view: pointer lock",
            "WASD: move",
            "Space: jump",
            "Shift: crouch",
            "Shift(long): slide",
            "Mouse move: view direction", 
            "Left click: shoot", 
            "Right click: ADS",
            "F: weapon mode", 
            "Q: wall", 
            "Z or wheel down: floor", 
            "C or wheel up: slope",
            "TAB: cone",
        ]

        context2d.fillStyle = "rgba(0, 0, 0, 0.5)"
        context2d.fillRect(10, 80, 250, fontSize*1.1*(array_string.length+1));
        context2d.fillStyle = "white"

        for(var i=0; i<array_string.length; i++){
            context2d.fillText(array_string[i], 10, 100 + fontSize*1.1 * i);
        }
        
        let w_ = W_ / 50;
        context2d.strokeStyle = "white"
        context2d.lineWidth = 1;
        context2d.beginPath();
        context2d.moveTo(W_/2, H_/2-w_);
        context2d.lineTo(W_/2, H_/2+w_);
        context2d.moveTo(W_/2-w_, H_/2);
        context2d.lineTo(W_/2+w_, H_/2);
        context2d.closePath();
        context2d.stroke();
    }
    mDraw2Dcontext()

}//init