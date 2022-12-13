/* a library that intercepts keystrokes and mouse clicks */
const keypress = require('keypress');
/* noise library for procedural landscape generation */
const simplex_noise = require('simplex-noise');
/* standard Node js module for working with filesystem */
const fs = require('fs');


/* application logs will be printed to process.stderr */
var debug = process.argv.indexOf('--debug') > -1;

var mapPath, mapFile, loadMap = process.argv.indexOf('--load') > -1;
    if(loadMap){
        let mapArg = process.argv.find( arg => arg.substring(0, 5) == 'file=');
		mapPath = './' + mapArg.substring(5);
		mapFile = fs.readFileSync(mapPath, {encoding:'utf8', flag:'r'});
	}

var editor = process.argv.indexOf('--editor') > -1;


const world_seed = Math.random() * Math.random();

/* a noise instance with a specific seed */
const simplex = new simplex_noise(world_seed);

/* screen sizes in characters and a buffer for storing temporary data */
var window_width, window_height, buffer = {};
/* the player's position on the screen, y starts from the top */
var playerpos = {x: 0, y: 0};
var worldpos = {x: 0, y: 0};

var max_health = 10;


/* basic game constants */
const Vars = {
	app_name: 'terminal game',
	app_version: '0.1.91',
	
	fps: 60,
	window_width: 45,
	window_height: 40,
	
	/* ANSI codes for changing the color of characters */
	color_codes: {
		reset: '\x1b[0m',
		
		black: '\x1b[30m',
		red: '\x1b[31m',
		green: '\x1b[32m',
		yellow: '\x1b[33m',
		blue: '\x1b[34m',
		magenta: '\x1b[35m',
		cyan: '\x1b[36m',
		white: '\x1b[37m',
		
		red_bright: '\x1b[91m',
	    green_bright: '\x1b[92m',
	    yellow_bright: '\x1b[93m',
	    blue_bright: '\x1b[94m',
		magenta_bright: '\x1b[95m',
		cyan_bright: '\x1b[96m',
		white_bright: '\x1b[97m'
	},
	
	/* ANSI codes for changing the background color */
	color_codes_background: {
		reset: '\x1b[7m',
		
		black: '\x1b[40m',
		red: '\x1b[41m',
		green: '\x1b[42m',
		yellow: '\x1b[43m',
		blue: '\x1b[44m',
		magenta: '\x1b[45m',
		cyan: '\x1b[46m',
		white: '\x1b[47m',
		
		red_bright: '\x1b[101m',
		green_bright: '\x1b[102m',
		yellow_bright: '\x1b[103m',
		blue_bright: '\x1b[104m',
		magenta_bright: '\x1b[105m',
		cyan_bright: '\x1b[106m',
		white_bright: '\x1b[107m'
	},
};

/* game server */
class SocketServer {
	static create(address, port){
		
	}
}

/* game client for connection to server */
class SocketClient {
	static connect(address, port){
		
	}
}

/* a game object that occupies one character on the screen */
class Entity {
	constructor(name, color_code, sym) {
		this.name = name;
		this.color_code = color_code;
		this.sym = sym || ' ';//'\u0000';
	}
} 

/* will be used in future multiplayer */
class Player extends Entity {
	constructor(nickname){
		super('player', Vars.color_codes['red_bright'], '*')
		
		this.nickname = nickname;
	}
}

class Random {	
	static basic(min, max, round = true) {
        let number = min + Math.random()*(max - min);
		
        return round ? Math.round(number) : number;
    }
	
	static chance(percent) {
		return this.basic(0, 100, false) <= Number(percent);
	}
	
	static seed(seed, min, max, round = true) {
        let number = '0.' + Math.round(seed * 16807 % 2147483647);
		number = min + Number(number)*(max - min);
		
        return round ? Math.round(number-10) : number;
	}
	
	static chanceSeed(seed, percent) {
		return this.seed(seed, 0, 100, false) <= Number(percent);
	}
}

/* all existing game entities and their ids */
class Resourses {
	static load() {
		this.entities = {
			//[0]: new Entity(),
			
			
			//[11]: new Entity('grass', Vars.color_codes_background['green']),
			//[12]: 
			
	        [0]: new Entity('grass', Vars.color_codes_background['green']),
			[1]: new Entity('sand', Vars.color_codes_background['yellow_bright']),
			[2]: new Entity('shallow-water', Vars.color_codes_background['blue_bright']),
			//[3]: new Entity('water', Vars.color_codes
			[3]: new Entity('deep-water', Vars.color_codes_background['blue']),
			
			[4]: new Entity('bush', Vars.color_codes['green'], '♣'),
			[5]: new Entity('flower', Vars.color_codes['yellow_bright'], '°'),
			[6]: new Entity('seaweed', Vars.color_codes['green'], '░'),
			
			[7]: new Entity('ruin-top-left', Vars.color_codes['white_bright'], '╔'),
			[8]: new Entity('ruin-top-right', Vars.color_codes['white_bright'], '╗'),
			[9]: new Entity('ruin-bottom-left', Vars.color_codes['white_bright'], '╚'),
			[10]: new Entity('ruin-bottom-right', Vars.color_codes['white_bright'], '╝'),
			
			[13]: new Entity('ruined-floor', Vars.color_codes_background['white']),
			[14]: new Entity('ruined-crystal', Vars.color_codes['magenta_bright'], '♦'),
			//[15]: new Entity(
			
			[255]: new Entity('player', Vars.color_codes['red_bright'], ['▲', '►', '▼', '◄'])
		}
	}
	
	static get(id) {
		return this.entities[id] || undefined;
	}
}


/* one tile of the game world */
class Tile {
	constructor(floor, block) {
		this.floor = floor;
		this.block = block;
	}
}

/* a map assembled from a variety of tiles */
class Map {
	constructor(generator, post){
		this.generator = generator;
		this.post = post;
	}
	
	sizes(width, height) {
		this.width = width;
		this.height = height;
		
		this.tiles = new Array(height).fill([]).map(layer => new Array(width).fill([]).map(tile => new Tile(0, 0)));
		
		return this;
	}
	
	generate(){
		this.updatedTiles = new Set();
		
		for(let y = 0; y < this.height; y++) {
			for(let x = 0; x < this.width; x++) {
				let abs_x = worldpos.x*window_width + x;
				let abs_y = worldpos.y*window_height + y;
				
				const tile = this.generator(abs_x, abs_y);
				
				this.tiles[y][x] = tile;
				this.updatedTiles.add({x: x, y: y})
			}
		}
		
		for(let y = 0; y < this.height; y++) {
			for(let x = 0; x < this.width; x++) {
				let abs_x = worldpos.x*window_width + x;
				let abs_y = worldpos.y*window_height + y;
				
				const tile = this.post(this.tiles[y][x], abs_x, abs_y);
			}
		}
		
		return this;
	}
}

/* main application class */
class Game {
	static setProcessSettings() {
		if(debug)
		    process.stderr.write('[setProcessSettings]: setting process settings... ')
		
		process.title = Vars.app_name;
		
		this.updateSizes()
		
		process.stdin.on('resize', () => {
			Game.updateSizes()
			Game.map.sizes(window_width, window_height).generate()
		})
		
		this.setMenuKeypress()
		this.setGameKeypress()
		
		keypress(process.stdin)
		
		process.stdin.setRawMode(true)
        process.stdin.resume()
		
		process.stdout.write(`${Vars.color_codes['white_bright']}${Vars.color_codes_background['black']}`)
		
		/* hiding the pointer */
		process.stdout.write('\u001b[?25l')

		process.on('exit', this.exit)
	}
	
	static setGameKeypress() {
		/* processing of 'keypress' events in game*/
		process.stdin.on('keypress', (char, key) => {
			if(!key || Game.gameState != 'singleplayer') return;
			
			let oldpos = {x: playerpos.x, y: playerpos.y};
			
			switch(key.name) {
				case 'escape':
				    Game.gameState = 'menu';
					break;
				case 'up':
				    if(playerpos.o == 0)
				        playerpos.y -= 1;
					else
						playerpos.o = 0;
					break;
				case 'down':
				    if(playerpos.o == 2)
				        playerpos.y += 1;
					else
						playerpos.o = 2;
					break;
				case 'left':
				    if(playerpos.o == 3)
				        playerpos.x -= 1;
					else
						playerpos.o = 3;
					break;
				case 'right':
				    if(playerpos.o == 1)
				        playerpos.x += 1;
					else
						playerpos.o = 1;
					break;
			}
			
			if(playerpos != oldpos && 
			    (playerpos.x >= 0 && playerpos.x <= window_width) &&
				(playerpos.y >= 0 && playerpos.y <= window_height)
			){
				Game.map.updatedTiles.add(playerpos)
			    Game.map.updatedTiles.add(oldpos)
			}
        })
    }
	
	static setMenuKeypress() {
		/* processing of 'keypress' events in menu*/
		process.stdin.on('keypress', (char, key) => {
			if(!key || Game.gameState == 'singleplayer') return;
			
			switch(key.name) {
				case 'escape':
				    Game.exit()
					break;
				case 'up':
					buffer.activeButton -= 1;
					break;
				case 'down':
					buffer.activeButton += 1;
					break;
				case 'return':
				    Game.menuButtons[buffer.activeButton].onclick()
				    break;
				case 'f5':
				    debug = true;
				    break;
			}
			buffer.activeButton = (buffer.activeButton<0) ? Game.menuButtons.length-1 : buffer.activeButton%Game.menuButtons.length;
        })
	}
	
	static exit(code) {
		if(debug)
			process.stderr.write('[exit]: the application is closed ')
		
		process.stdin.pause()
		
		process.stdout.write('\u001b[?25h')
		process.stdout.write(`${Vars.color_codes['reset']}`)
		
		console.clear()
		process.exit(code || 0)
	}
	
	static init() {
		if(debug)
		    process.stderr.write('[init]: init() is called ')
		
		this.setProcessSettings()
		
		playerpos.x = Math.round(window_width/2);
	    playerpos.y = Math.round(window_height/2);
		playerpos.o = 0;
		playerpos.h = 10;
		
		this.resourses = Resourses;
		
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
        
		/* map generation */
		this.map = new Map( (x, y) => {
			if(loadMap){
				let loadedMap = JSON.parse(mapFile);
				
				let floor = Number(loadedMap[y][x][0]);
				let block = Number(loadedMap[y][x][1]);
				
				return new Tile(floor || 0, block || null);
			}
			
			let elevation = Math.abs(noise(x, y, 10, [1, 3, 4]));
			
			let random = Random.seed(world_seed + (Math.abs(x)**Math.abs(y)), 0, 1, false);
			
			var floor, block;
			
			if(elevation <= 0.2){
				floor = elevation < 0.08 ? 3 : 2;
				if(elevation > 0.06 && random > 0.6)
					block = 15;
			}else if(elevation <= 0.4){
				floor = 1;
				if(random > 0.94) block = 6;
			}else{
				floor = 0;
				
				if(random > 0.95){
					block = 4;
				}else if(random > 0.75){
				    block = 5;
				}
			}
			
			return new Tile(floor || 0, block || null)
		}, (tile, x, y) => {
			if(loadMap)
				return tile;
			
			let ruin_x = Random.seed(world_seed, 0, 80) - 40;
			let ruin_y = Random.seed(world_seed*2, 0, 80) - 40;
			
			if(Math.abs(ruin_x+2 - x) <= 2 && Math.abs(ruin_y+2 - y) <= 2){
				tile.block = null;
				tile.floor = 13;
			}
			
			if(x == ruin_x && y == ruin_y){
				tile.block = 7;
			}else if(x == ruin_x+4 && y == ruin_y){
				tile.block = 8;
			}else if(x == ruin_x && y == ruin_y+4){
				tile.block = 9;
			}else if(x == ruin_x+4 && y == ruin_y+4){
				tile.block = 10;
			}else if(x == ruin_x+2 && y == ruin_y+2){
				tile.block = 14;
			}
			
			return tile;
		}).sizes(window_width, window_height);
	}
	
	static updateSizes() {
		window_width = process.stdout.getWindowSize()[0]+1;
        window_height = process.stdout.getWindowSize()[1];
		
		if(window_width != Vars.window_width || window_height != Vars.window_height){
			Game.crashed = true;
			process.stdout.write(`Current screen sizes:${window_width}x${window_height}  `)
			process.stdout.write(`${Vars.color_codes['red_bright']}Please right-click on the window at the top, go to the properties section and set the buffer size manually(the height really should be more): ${Vars.window_width}x${Vars.window_height} and restart the game!${Vars.color_codes['reset']}  `)
		}
	}
	
	/* the function of displaying the image on the screen */
	static render(map, res) {
		if(Game.crashed)
			return;
		
		/* updating a separate sign on the screen for optimization */
		let updatePixel = (x, y, string) => {
			process.stdout.write(`\u001b[${y};${x}H${string}`)
			
			process.stdout.write(`${Vars.color_codes['reset']}`)
		};
		
		if(buffer.gameState != this.gameState){
			/*if(this.gameState == 'menu'){
				this.setMenuKeypress()
			}else if(this.gameState == 'singleplayer'){
				this.setGameKeypress()
			}*/
			
			if(this.gameState == 'singleplayer'){
				this.map.generate()
			}
			
			buffer.gameState = this.gameState;
			buffer.activeButton = 0;
			console.clear()
		}
		
		function renderButtons(buttons){
			for(let i in buttons){
				let button = buttons[i];
				
				if(Number(i) == Number(buffer.activeButton))
					process.stdout.write(`${Vars.color_codes_background['red']}`)
				
				let button_x = Math.round((window_width-button.text.length-2)/2);
				let button_y = Math.round(window_height/2) + Number(i)*2;

				updatePixel(button_x, button_y, `[ ${button.text} ]`)
			}
	    }
		
		if(this.gameState == 'menu'){
			this.menuButtons = [
			    { text: 'singleplayer', onclick() { Game.gameState = 'singleplayer'; } },
				{ text: 'multyplayer ', onclick() { Game.gameState = 'server-connect'; } },
				{ text: '  settings  ', onclick() { Game.gameState = 'settings-menu'; } }
			];
			
			renderButtons(this.menuButtons)
			
			let version_x = window_width - Vars.app_version.length;
			let version_y = window_height - 1;
			
			updatePixel(version_x, version_y, `${Vars.app_version}`)
			
			return;
		}else if(this.gameState == 'server-connect'){
			this.menuButtons = [
			    { text: 'join the game', onclick() { Game.gameState = 'singleplayer'; } },
				{ text: 'host the game', onclick() { Game.gameState = 'menu'; } }
			];
			
			renderButtons(this.menuButtons)
			
			return;
		}else if(this.gameState == 'singleplayer'){
			
			if(playerpos.x < 0){
			    playerpos.x = window_width;
			    worldpos.x -= 1;
			    map.generate()
		    }else if(playerpos.x > window_width){
			    playerpos.x = 0;
			    worldpos.x += 1;
			    map.generate()
		    }else if(playerpos.y < 0){
			    playerpos.y = window_height;
			    worldpos.y -= 1;
			    map.generate()
		    }else if(playerpos.y > window_height){
			    playerpos.y = 0;
			    worldpos.y += 1;
			    map.generate()
		    }
		    
		    /* updating only changed tiles for optimization */
		    for(let _tile of map.updatedTiles) {
				if(!map.tiles[_tile.y] || !map.tiles[_tile.y][_tile.x])
					continue;
				
			    let tile = map.tiles[_tile.y][_tile.x];
			    
			    let tileString = '';
			    
			    let floor = res.get(tile.floor);
			    let block = res.get(tile.block);
			    
			    tileString += floor.color_code;
			
			    if(_tile.x == playerpos.x && _tile.y == playerpos.y){
				    tileString += res.get(255).color_code;
                    tileString += res.get(255).sym[playerpos.o];					
			    }else if(block){
				    tileString += block.color_code;
				    tileString += block.sym;
			    }else{
				    tileString += floor.sym;
			    }
			    
			    updatePixel(_tile.x, _tile.y, tileString)
			    
			    map.updatedTiles.delete(_tile)
		    }
			
			let abs_playerx = worldpos.x*window_width + playerpos.x;
			let abs_playery = worldpos.y*window_height + playerpos.y;
			
			updatePixel(0, 0, `               `)
			updatePixel(0, 0, `x: ${abs_playerx}; y: ${abs_playery}`)
			
			let health_x = window_width - max_health;
			for(let x = 0; x < max_health; x++){
				updatePixel(health_x + x, 0, `${playerpos.h > x ? Vars.color_codes['red_bright'] : Vars.color_codes['white']}♥`)
			}
		}
	}
	
	static load() {
		if(debug)
		    process.stderr.write('[load]: load() is called ')
		
		this.resourses.load()
		this.map.generate()
	}

	/* the main function of the application */
	static main() {
		if(debug)
		    process.stderr.write('[main]: the application is running... ')
		
		this.gameState = 'menu';
		
		this.init()
	    this.load()
		
		let map = this.map;
		let res = this.resourses;
		
		setInterval(() => Game.render(map, res), 1000/Vars.fps)
	}
}

Game.main()
