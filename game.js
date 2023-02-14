/* built-in module for reading data from the command line */
const readline = require('readline');
/* built-in module for measuring time and performance */
const performance = require('perf_hooks').performance;
/* built-in module for working with filesystem */
const filesystem = require('fs');
/* built-in module for getting information about the operating system */
const system = require('os');
/* Built-in module for working with file names and paths */
const path = require('path');
/* noise library for procedural landscape generation */
const simplex_noise = require('simplex-noise');

/* buffer with stored and frequently changed data */
const buffer = {};

/* a class for displaying debug messages in a separate file */
class Logger {
	constructor(file) {
		this.outStream = filesystem.createWriteStream(file);
	}
	
	log(isError, from, text){
		//if(!Vars.isDebug)
		//	return;
		
		let type = isError ? 'E' : 'D';
		//let time = performance.now().toFixed(2);
		
		this.outStream.write(`[${type}] ${from}: ${text}${system.EOL}`)
	}
};

class Screen {
	constructor() {
		this.outStream = process.stdout;
	}
	
	updatePixel(x, y, string) {
		this.outStream.write(`\u001b[${y};${x}H${string}`)
		process.stdout.write('\x1b[0m\x1b[49m')
	}
};

class Random {
	static basic(min, max, round = true) {
        let number = min + Math.random()*(max - min);
		
        return round ? Math.round(number) : number;
    }
	
	static chance(percent) {
		return this.basic(0, 100, false) <= Number(percent);
	}
	
	static seed(seed, min, max, round = true) {
		let a = Number(seed);
		
        function get() {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
		
		let num = min + get()*(max-min);
		
        return round ? Math.round(num) : num;
	}
	
	static chanceSeed(seed, percent) {
		return this.seed(seed, 0, 100, false) <= Number(percent);
	}
};

/* global game variables */
const Vars = {
	appName: 'terminal game',
	appVersion: '0.2.0',
	
	maps_dir: './maps/',
	maps_ext: '.json',
	map_name_length: 16,
	
	crashed: false,
	isDebug: false,
	worldSeed: Math.random(),
	
	frameRate: 30,
	colorMode: 0,

    logger: new Logger('./logs.txt'),
	screen: new Screen(),
	
    window_width: 45,
	window_height: 40
};

class Entity {
	constructor(name, colorCodes, symbols = [' '], symbolChoise = 0) {
		this.name = name;
		this.colorCodes = colorCodes;
		this.symbols = symbols;
		this.symbolChoise = symbolChoise;
	}
	
	color() {
		return `\x1b[${this.colorCodes[Vars.colorMode]}m`;
	}
	
	symbol(x, y, t) {
		let time = (new simplex_noise(x+y).noise2D(Math.floor(t/50), 0) + 1)/2;
		
		if(this.symbolChoise == 0){
			return this.symbols[0];
		}else if(this.symbolChoise == 1){
			return this.symbols[Math.round(time*(this.symbols.length-1))];
		}
		
		return this.symbols[0];
	}
	
	animated() {
		return this.symbolChoise == 1;
	}
};

class Block extends Entity {
	constructor(name, colorCodes, symbols, symbolChoise = 0, walkable = false){
		super(name, colorCodes, symbols, symbolChoise)
		
		this.walkable = walkable;
	}
};

class Floor extends Entity {
	
};

class Player extends Entity {
	constructor(x, y, maxHealth) {
		super('entity-player', [31, '38;5;124'], ['▲', '►', '▼', '◄'])
		
		this.set(x, y)
		
		this.orientation = 0;
		this.maxHealth = maxHealth;
		this.health = maxHealth;
		
		this.storage = new Array(9).fill(-1);
	}
	
	symbol(context) {
		return this.symbols[this.orientation];
	}
	
	set(x, y) {
		this.x = x || 0;
		this.y = y || 0;
	}
}

/* all existing game entities and their ids */
class Resourses {
	static load() {
		this.entities = {
			/* -- region special -- */
			[0]: new Entity('void', [0, 0, 'black']),
			
			/* -- region floors -- */
			[1]: new Floor('floor-stone', [100, '48;5;241', 'grey']),
			[2]: new Floor('floor-grass', [42, '48;5;28', 'green']),
			[3]: new Floor('floor-sand',  [103, '48;5;227', 'yellow']),
			[4]: new Floor('floor-snow',  [107, '48;5;15', 'white']),
			[5]: new Block('floor-ruin',  [47, '48;5;239', 'firebrick']),
			/* 6 - 9 ids are reserved */
			[10]: new Floor('floor-shallow-water', [104, '48;5;20', 'blue']),
			[11]: new Floor('floor-deep-water',    [44, '48;5;17', 'navy']),
			[12]: new Floor('floor-medium-depth-water', [44, '48;5;17', 'navy'], ['\x1b[0m\x1b[104m ', '\x1b[44m '], 1),
			/* 13 - 15 ids are reserved */
			
			/* -- region blocks -- */
			[16]: new Block('block-small-bush', ['1;92', '38;5;22', 'darkgreen'], ['♣', '♠'], 1),
			/* 17 - 20 ids are reserved */
			[21]: new Block('block-ruin-horizontal',   [33, '38;5;236'], ['═']),
			[22]: new Block('block-ruin-vertical',     [33, '38;5;236'], ['║']),
			[23]: new Block('block-ruin-top-left',     [33, '38;5;236'], ['╔']),
			[24]: new Block('block-ruin-top-right',    [33, '38;5;236'], ['╗']),
			[25]: new Block('block-ruin-bottom-left',  [33, '38;5;236'], ['╚']),
			[26]: new Block('block-ruin-bottom-right', [33, '38;5;236'], ['╝']),
			[27]: new Block('block-mangeta-crystal',   [35, '38;5;92']   ['♦']),
			/* 28 - 31 ids are reserved */
			
			/* -- region overlays -- */
			[32]: new Block('overlay-sunflower', [93, '38;5;226', 'yellow'], ['°'], 0, true),
			[33]: new Block('overlay-seaweed',   [32, '38;5;34', 'seagreen'], ['░'], 0, true),
		}
	}
	
	static getEntity(id) {
		return this.entities[id] || undefined;
	}
};

/* one tile of the game map */
class Tile {
	constructor(floor, block) {
	    if(!(floor instanceof Floor)) floor = Resourses.getEntity(0);
		if(!(block instanceof Block)) block = null;
		
		this.floor = floor;
		this.block = block;
	}
};

class WorldGenerator {
	generate(x, y) {
		return new Tile(Resourses.getEntity(0), null);
	}
};

class MainWorldGenerator extends WorldGenerator {
	generate(x, y, lx, ly) {
		let tile = super.generate(x, y);
		
		let simplex = new simplex_noise(Vars.worldSeed);
		
		/* octave simplex noise function */
		let noise = (x, y, scl, octaves) => {
		    let elevation = 0, octaveSum = 0;
	        if(!Array.isArray(octaves))
			    octaves = new Array(octaves).fill().map( (v, i) => i+1 );

            for(let octave of octaves){
	            elevation += octave * simplex.noise2D(x / (scl*octave), y / (scl*octave));
	            octaveSum += octave;
            }
            return elevation / octaveSum; 
	    };
		
		let elevation = noise(x, y, 10, [1, 3, 4]);
		
		var floor, block;
		
		let random_seed = (simplex.noise2D(x, y)+1)*50;
		
		if(elevation <= -0.2){
		    floor = elevation < -0.4 ? ( elevation > -0.46 ? 12 : 11) : 10;
		}else if(elevation <= 0){
			floor = 3;
			
			if(random_seed < 18)
				block = 33;
		}else if(elevation <= 0.4){
			floor = 2;
				
			if(random_seed < 11){
				block = 16;
			}else if(random_seed < 15){
				block = 32;
			}
		}else if(elevation <= 0.6){
			floor = 1;
		}else{
			floor = 4;
		}
		
		tile.floor = Resourses.getEntity(floor);
		tile.block = Resourses.getEntity(block);
		
		return tile;
	}
};

class FileWorldGenerator extends WorldGenerator {
	constructor(data) {
		super()
		
		try { 
		    this.data = data;
		} catch(error) {
			Vars.logger.log(true, 'FileWorldGenerator.constructor()', `Failed to load data: ${error}`);
		}
	}
	
	generate(x, y) {
		if(y < 0 || y >= this.data.length || x < 0 || x >= this.data[0].length)
            return new Tile(Resourses.getEntity(0), null);			
			
		let floor = Resourses.getEntity(Number(data[y][x][0]));
		let block = Resourses.getEntity(Number(data[y][x][1]));
		
		return new Tile(floor || Resourses.getEntity(0), block || null);
	}
	
	sizes(){}
};

/* a map assembled from a variety of tiles */
class Map {
	constructor(name, generator){
		this.name = name;
		this.generator = generator;
		/* a lot of tiles modified by the player */
		/* absolute coordinates */
		this.changedTiles = new Set();
		/* a lot of tiles that differ from the on-screen ones */
		/* relative coordinates */
		this.updatedTiles = new Set();
		
		this.width = 0;
		this.height = 0;
	}
	
	sizes(width, height) {
		this.width = width;
		this.height = height;
		
		this.tiles = new Array(height).fill([]).map(layer => new Array(width).fill([]).map(tile => new Tile(0, 0)));
		
		return this;
	}
	
	generateLocation(locationX, locationY) {
		this.updatedTiles.clear()
		
		let startX = locationX * Vars.window_width;
		let startY = locationY * Vars.window_height;
		
		for(let y = 0; y < this.height; y++) {
		    for(let x = 0; x < this.width; x++) {
				let abs_x = startX + x;
				let abs_y = startY + y;
				
				let tile = this.generator.generate(abs_x, abs_y, locationX, locationY);
				
				this.tiles[y][x] = tile;
				this.updatedTiles.add({x: x, y: y})
			}				
		}
		
		for(let tile of this.changedTiles) {
			let x = tile.x - startX;
			let y = tile.y - startY;
			
			if(x < 0 || x >= this.width || y < 0 || y >= this.height)
				continue;
			
			this.tiles[y][x] = new Tile(tile.floor || Resourses.getEntity(0), tile.block || null);
		}
		
		return this;
	}
};


/* main application class */
class Game {
	static setProcessSettings() {
		Vars.logger.log(false, 'Game.setProcessSettings()', 'The function is called...')
		
		process.title = Vars.appName;
		
		this.updateSizes()
		this.setKeypress()
		
		process.on('unhandledRejection', (reason, promise) => {
            Vars.logger.log(true, 'mainContext', `reason: ${reason}; promise: ${promise}`);
        }).on('uncaughtException', error => {
            Vars.logger.log(true, 'mainContext', `${error}${system.EOL}    Trace: ${error.stack}`);
            process.exit(1);
        });
		
        if (process.stdin.isTTY)
            process.stdin.setRawMode(true);
		
		/* hiding the pointer */
		process.stdout.write('\u001b[?25l')

		process.on('exit', this.exit)
	}
	
	static setKeypress() {
		readline.emitKeypressEvents(process.stdin);
		
		process.stdin.on('keypress', (char, key) => {
			if(!key || !key.name) return;
			
			let player = Game.player;
			let gameState = Game.gameState;
			
			if(key.name == 'f5'){
				Vars.isDebug = !Vars.isDebug;
				Game.showMessage(Vars.isDebug ? 'debugging is enabled' : 'debugging is disabled', false)
			}
			
			if(!!Number(key.name) && Number(key.name) > 0 && Number(key.name) <= Game.player.storage.length){
				buffer.activeItem = Number(key.name);
			}
			
		    if(gameState == 'singleplayer'){
				function getScreenPos(){
                    let locationX = Math.floor(player.x / Vars.window_width);
			        let locationY = Math.floor(player.y / Vars.window_height);

				    return {
						x: player.x - locationX*Vars.window_width,
						y: player.y - locationY*Vars.window_height
					}
				}
				
				let oldpos = getScreenPos();
				
			    switch(key.name) {
				    case 'escape':
				        Game.gameState = 'menu';
						process.stdout.write('\x07')
					    break;
				    case 'up':
				        if(player.orientation == 0) player.y -= 1;
					    else {
							player.orientation = 0;
							Game.map.updatedTiles.add(oldpos)
						}
					    break;
				    case 'down':
				        if(player.orientation == 2) player.y += 1;
					    else {
							player.orientation = 2;
							Game.map.updatedTiles.add(oldpos)
						}
					    break;
				    case 'left':
				        if(player.orientation == 3) player.x -= 1;
					    else {
							player.orientation = 3;
							Game.map.updatedTiles.add(oldpos)
						}
					    break;
				    case 'right': 
					    if(player.orientation == 1) player.x += 1;
					    else {
							player.orientation = 1;
							Game.map.updatedTiles.add(oldpos)
						}
					    break;
			    }
				
				if(player.x != oldpos.x || player.y != oldpos.y){
				    Game.map.updatedTiles.add(oldpos)
			        Game.map.updatedTiles.add(getScreenPos())
				}
		    }else {
				switch(key.name) {
				    case 'escape':
					    process.stdout.write('\x07')
				        if(gameState == 'menu'){
							Game.exit()
						}else{
							Game.gameState = 'menu';
						}
					    break;
				    case 'up':
					    buffer.activeButton -= 1;
					    break;
				    case 'down':
					    buffer.activeButton += 1;
					    break;
				    case 'return':
				        Game.menuButtons[buffer.activeButton].onclick()
						process.stdout.write('\x07')
				        break;
			    }
				
				buffer.activeButton = (buffer.activeButton<0) ? Game.menuButtons.length-1 : buffer.activeButton%Game.menuButtons.length;
			}
		})
	}
	
	static exit(code) {
		Vars.logger.log(false, 'Game.exit()', 'The application is closed.')
		
		process.stdout.write('\u001b[?25h')
		process.stdout.write('\x1b[0m')
		
		console.clear()
		process.exit(code || 0)
	}
	
	static loadMaps() {
		try {
		    let files = filesystem.readdirSync(Vars.maps_dir);
		    this.maps = [];
			
			for(let file of files) {
				if(path.extname(file) == Vars.maps_ext)
					this.maps.push(file)
			}
		}catch(error) {
			console.log(`Error reading the directory ${Vars.maps_dir}`)
			Vars.logger.log(true, 'Game.loadMaps()', `Error reading the directory ${Vars.maps_dir}: ${error}`)
		}
	}
	
	static init() {
		Vars.logger.log(false, 'Game.init()', 'The function is called...')
		
		this.setProcessSettings()
		
		let playerX = Math.round(Vars.window_width/2);
	    let playerY = Math.round(Vars.window_height/2);
		
		Resourses.load()
		
		buffer.activeItem = 1;
		
		this.player = new Player(playerX, playerY, 10);
		Game.map = new Map('infinity', new MainWorldGenerator()).sizes(Vars.window_width, Vars.window_height);
	}
	
	static updateSizes() {
		Vars.logger.log(false, 'Game.updateSizes()', 'The function is called...')
		
		let stdout = process.stdout;
		
		stdout.on('resize', () => {
			Game.updateSizes()
			Game.map.sizes(Vars.window_width, Vars.window_height).generate()
		})
		
		let window_width = (stdout.columns || stdout.getWindowSize()[0]) + 1;
        let window_height = stdout.rows || stdout.getWindowSize()[1];
		
		if(window_width != Vars.window_width || window_height != Vars.window_height){
			Vars.crashed = true;
			process.stdout.write(`Current screen sizes:${window_width-1}x${window_height}  `)
			process.stdout.write(`Please right-click on the window at the top, go to the properties section and set the buffer size manually(the height really should be more): ${Vars.window_width-1}x${Vars.window_height} and restart the game!`)
		}
	}
	
	static showMessage(text, toMenu = true) {
		let storedState = this.gameState;
		
		this.gameState = 'errored';
		this.menuButtons = [{ text: text, onclick() { 
	        if(toMenu){
		        Game.gameState = 'menu';
		    }else{
				Game.gameState = storedState;
			}
		}}];
		this.renderButtons(this.menuButtons)
	}
	
	static renderButtons(buttons){
	    for(let i in buttons){
			let button = buttons[i];
			
			let active = false;
				
			if(Number(i) == Number(buffer.activeButton)){
				process.stdout.write(`\x1b[31m`)
				active = true;
			}
				
			let button_x = Math.round((Vars.window_width - button.text.length-2)/2);
			let button_y = Math.round(Vars.window_height/2) + Number(i)*2;

			Vars.screen.updatePixel(button_x, button_y, 
			    `${active?'>':button.s||'['} ${button.text} ${active?'<':button.e||']'}`)
		}
	}
	
	static renderStorage(){
		let storage = Game.player.storage;
		
		let line1 = '\x1b[100m';
		let line2 = '\x1b[100m';
		
		for(let i = 0; i < storage.length; i++){
			let active = buffer.activeItem-1 == i;
			let nextActive = buffer.activeItem == i;
			
			if(active || nextActive){
				line1 += '\x1b[39;49m\x1b[40m';
				line2 += '\x1b[39;49m\x1b[40m';
			}else{
				line1 += '\x1b[39;49m\x1b[100m';
			    line2 += '\x1b[39;49m\x1b[100m';
			}
			
			line1 += (i == 0) ? (active ? '╓─' : '┌─') : nextActive ? '╥\x1b[39;49m\x1b[100m─' : (active ? '╥─' : '┬─');
			
			line2 += nextActive ? `║\x1b[39;49m\x1b[100m${i+1}` : (active ? `║${i+1}` : `│${i+1}`);
			
			if(i == storage.length-1){
				line1 += active ? '╖' : '┐';
				line2 += active ? '║' : '│';
			}
		}
		
		let x = Math.floor((Vars.window_width-2*storage.length-1) / 2);
		
		Vars.screen.updatePixel(x, Vars.window_height-2, line1)
		Vars.screen.updatePixel(x, Vars.window_height-1, line2)
	}
	
	/* the function of displaying the image on the screen */
	static render() {
		if(Vars.crashed)
			return;
		
		let updatePixel = (x, y, string) => {
			Vars.screen.updatePixel(x, y, string)
		}
		
        let locationX = Math.floor(this.player.x / Vars.window_width);
	    let locationY = Math.floor(this.player.y / Vars.window_height);
		
		if(buffer.gameState != this.gameState) {
			if(this.gameState == 'singleplayer'){
				this.map.generateLocation(locationX, locationY)
			}
			
			buffer.gameState = this.gameState;
			buffer.activeButton = 0;
			
			console.clear()
		}
		
		if(this.gameState == 'menu'){
			this.menuButtons = [
			    { text: 'endless mode', onclick() { 
				    Game.gameState = 'singleplayer'; 
				    Game.map = new Map('infinity', new MainWorldGenerator()).sizes(Vars.window_width, Vars.window_height);
				}},
				{ text: 'multyplayer ', onclick() { Game.gameState = 'server-connect';} },
				{ text: '  load map  ', onclick() { Game.gameState = 'map-selection'; } },
				{ text: '  settings  ', onclick() { Game.gameState = 'settings-menu'; } }
			];
			
			this.renderButtons(this.menuButtons)
			
			let version_x = Vars.window_width - Vars.appVersion.length;
			let version_y = Vars.window_height - 1;
			
			updatePixel(version_x, version_y, `${Vars.appVersion}`)
			
			return;
		}else if(this.gameState == 'errored'){
			this.renderButtons(this.menuButtons)
		}else if(this.gameState == 'map-selection'){
			this.menuButtons = [];
			
			for(let map of this.maps){
				let mapName = map || 'unnamed';
				
				if(mapName.length > Vars.map_name_length)
				mapName = `${mapName.slice(0, Vars.map_name_length-3)}...`;
				
				if(mapName.length < Vars.map_name_length){
					let spaces = ' '.repeat(Vars.map_name_length - mapName.length);
					mapName = mapName + spaces;
				}
				
				this.menuButtons.push({ text: mapName, onclick() { 
					try{
					    let json = JSON.parse(filesystem.readFileSync(Vars.maps_dir+this.text, { encoding: 'utf8', flag: 'r' }));
						
						Game.map = new Map(json[0] || 'unnamed', new FileWorldGenerator(json[1]));
						
					    Game.gameState = 'singleplayer'; 
					}catch(error){
						Game.showMessage('Map load error!')
						Vars.logger.log(true, 'Game.render()', `Map load error: ${error}`)
					}
				}})
			}
			
			this.renderButtons(this.menuButtons)
			
			return;
		}else if(this.gameState == 'server-connect'){
			this.menuButtons = [
			    { text: 'join the game', onclick() { Game.gameState = 'singleplayer'; } },
				{ text: 'host the game', onclick() { Game.gameState = 'menu'; } }
			];
			
			this.renderButtons(this.menuButtons)
			
			return;
		}else if(this.gameState == 'singleplayer'){
			let map = this.map;
		    
			if(buffer.locationX != locationX || buffer.locationY != locationY){
				buffer.locationX = locationX;
				buffer.locationY = locationY;
				
				map.generateLocation(locationX, locationY)
			}
			
			for(let y = 0; y < Vars.window_height; y++){
			    for(let x = 0; x < Vars.window_width; x++){
					let tile = map.tiles[y][x];
					
					if((tile.floor.animated() || (tile.block && tile.block.animated())) && y > (Vars.isDebug ? 2 : 1) && y < Vars.window_height-3)
						this.map.updatedTiles.add({x: x, y: y})
				}
			}
			
		    for(let _tile of map.updatedTiles) {
				if(!map.tiles[_tile.y] || !map.tiles[_tile.y][_tile.x])
					continue;
				
			    let tile = map.tiles[_tile.y][_tile.x];
			    let tileString = '';
			    
			    tileString += tile.floor.color();
				
				let abs_x = _tile.x + locationX*Vars.window_width;
				let abs_y = _tile.y + locationY*Vars.window_height;
			
			    if(_tile.x == this.player.x-locationX*Vars.window_width && _tile.y == this.player.y-locationY*Vars.window_height){
				    tileString += this.player.color();
                    tileString += this.player.symbol();					
			    }else if(tile.block){
				    tileString += tile.block.color();
				    tileString += tile.block.symbol(abs_x, abs_y, Game.ticks);
			    }else{
				    tileString += tile.floor.symbol(abs_x, abs_y, Game.ticks);
			    }
			    
			    updatePixel(_tile.x, _tile.y, tileString)
			    
			    map.updatedTiles.delete(_tile)
		    }
			
			if(Vars.isDebug){
			    updatePixel(0, 0, ' '.repeat(Vars.window_width-1))
				updatePixel(0, 2, ' '.repeat(Vars.window_width-1))
			    updatePixel(0, 0, `lx: ${locationX}; ly: ${locationY}; x: ${this.player.x}; y: ${this.player.y}`)
				let memoryTotal = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1);
				let memoryUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
				
				updatePixel(0, 2, `memory usage total: ${memoryTotal}mb used: ${memoryUsed}mb`)
		    }
			
			let health_x = Vars.window_width - this.player.maxHealth;
			for(let x = 0; x < this.player.maxHealth; x++){
				updatePixel(health_x + x, 0, `${this.player.health > x ? '\x1b[31m' : '\x1b[37m'}♥`)
			}
			
			Game.renderStorage()
		}
	}
	
	static load() {
		Vars.logger.log(false, 'Game.load()', 'The function is called...')
		
		this.loadMaps()
		this.map.generateLocation(0, 0)
		Vars.logger.log(false, 'Game.load()', 'First location is generated.')
	}

	/* the main function of the application */
	static main() {
		Vars.logger.log(false, 'Game.main()', 'The application is running...')
		
		this.gameState = 'menu';
		
		this.init()
	    this.load()
		
		setInterval(() => {
			Game.render()
			Game.ticks++;
		},1000/Vars.frameRate)
	}
	
	static ticks = 0;
}

Game.main()