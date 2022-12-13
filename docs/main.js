let width = 45;//45
let height = 40;//40
let p = 10;

let canvas = document.getElementById('canvas');
let select_entity = document.getElementById('select-entity');
let select_layer  = document.getElementById('select-layer');
let select_tool   = document.getElementById('select-tool');

canvas.width = width*p;
canvas.height = height*p;

let map = new Array(height).fill([]).map( () => new Array(width).fill(0).map( () => [null, null]) );

let ctx = canvas.getContext('2d');

let layer = 0;

class Entity {
	constructor(name, color, sym) {
		this.name = name;
		this.color = color;
		this.sym = sym || ' ';
	}
} 

let entities = {
	[0]: new Entity('grass', 'green'),
	[1]: new Entity('sand', 'yellow'),
	[2]: new Entity('shallow-water', 'blue'),

	[3]: new Entity('deep-water', 'blue'),

	[4]: new Entity('bush', 'green', '\u2663'),
	[5]: new Entity('flower', 'yellow', '\u2022'),
	[6]: new Entity('seaweed', 'green', '\u2591'),
	
	[7]: new Entity('ruin-top-left', 'white', '╔'),
	[8]: new Entity('ruin-top-right', 'white', '╗'),
	[9]: new Entity('ruin-bottom-left', 'white', '╚'),
	[10]: new Entity('ruin-bottom-right', 'white', '╝'),
	
	[13]: new Entity('ruined-floor', 'white'),
	[14]: new Entity('ruined-crystal', 'magenta', '♦'),

	[255]: new Entity('player', 'red', ['▲', '►', '▼', '◄'])
};

for(let e in entities){
	let option = document.createElement('option');
	option.value = e;
	option.text = entities[e].name;
	
	select_entity.appendChild(option)
}

for(let l = 0; l < 3; l++){
	let option = document.createElement('option');
	option.value = l;
	option.text = `layer ${l+1}`;
	
	if(l == 2){
		option.text = 'all layers';
	}
	
	select_layer.appendChild(option)
}

let tools = [
    "brush",
	"fill"
];

let activeTool = 0;

for(let tool = 0; tool < tools.length; tool++){
	let option = document.createElement('option');
	option.value = tool;
	option.text = tools[tool];
	
	select_tool.appendChild(option)
}

select_tool.addEventListener('change', function(){
	activeTool = this.value;
})

select_entity.addEventListener('change', function(){
	activeEntity = this.value;
})

select_layer.addEventListener('change', function(){
	layer = this.value;
	render()
})

let activeEntity = '0';

function drawTile(x, y){
	let tile = map[y][x];
	
	if(!tile[layer])
		return;
	
	let entity = entities[tile[layer]];
	
	ctx.fillStyle = entities[tile[layer]].color;
	
	if(entity.sym == ' '){
	    ctx.fillRect(x*p, y*p, p, p)
	}else{
	    ctx.font = `${p}px serif`;
        ctx.fillText(entities[tile[layer]].sym, x*p, y*p);
	}
}

function render() {
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	
	for(let y = 0; y < height; y++){
        for(let x = 0; x < width; x++){
			if(layer == 2){
				layer = 0;
				drawTile(x, y)
				
				layer = 1;
				drawTile(x, y)
				
				layer = 2;
				continue;
			}
           
		   drawTile(x, y)
        }		
    }
}

let isDrawing = false;

function draw(e) {
	let w1 = canvas.clientWidth / width;
	let h1 = canvas.clientHeight / height;
	
	let x = Math.floor((e.clientX - canvas.offsetLeft) / w1);
	let y = Math.floor((e.clientY - canvas.offsetTop) / h1);
	
	if(layer == 2)
		return;
	
	if(activeTool == 1){
		let grid = new PF.Grid(width, height);
		
		let startX = x;
		let startY = y;
		let startEntity = map[y][x][layer];
		
		for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                grid.setWalkableAt(x, y, map[y][x][layer] == startEntity);
           }		
        }
		
		for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                var finder = new PF.AStarFinder();
				
				var path = finder.findPath(startX, startY, x, y, grid.clone())
				
				if(path.length > 1)
					map[y][x][layer] = activeEntity;
           }		
        }
		
		map[startY][startX][layer] = activeEntity;

	}else if(activeTool == 0){
		map[y][x][layer] = activeEntity;
    }
    render()
}

canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
	draw(e)
})

canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        draw(e)
    }
});

window.addEventListener('mouseup', (e) => {
    isDrawing = false;
})

render()

function toFile() {
	var a = document.getElementById("lfs");
    var file = new Blob([JSON.stringify(map)], {
        type: 'plain/text'
    })
    a.href = URL.createObjectURL(file);
    a.download = 'export.json';
    a.click();
}

document.getElementById('button-export').onclick = toFile;