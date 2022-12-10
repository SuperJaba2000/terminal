/* a library that intercepts keystrokes and mouse clicks */
const keypress = require('keypress');
/* noise library for procedural landscape generation */
const SimplexNoise = require('simplex-noise');

/* application logs will be printed to process.stderr */
var debug = process.argv.indexOf('--debug') > -1;


/* a noise instance with a specific seed */
const simplex = new SimplexNoise(Math.random()*Math.random());

/* screen sizes in characters and a buffer for storing temporary data */
var window_width, window_height, buffer = {};
/* the player's position on the screen, y starts from the top */
var playerpos = {x: 0, y: 0};
var worldpos = {x: 0, y: 0};


/* basic game constants */
const Vars = {
	app_name: 'terminal game',
	app_version: '0.1.7',
	
	fps: 60,
	window_width: 46,
	window_height: 40,
	
	/* ANSI codes for changing the color of characters */
	color_codes: {
		reset: '\x1b[0m',
		
		black: '\x1b[30m',
		red: '\x1b[31m',
		green: '\x1b[32m',
		yellow: '\x1b[33m',
		blue: '\x1b[34m',
		white: '\x1b[37m',
		
		red_bright: '\x1b[91m',
	    green_bright: '\x1b[92m',
	    yellow_bright: '\x1b[93m',
	    blue_bright: '\x1b[94m',
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
		
		red_bright: '\x1b[101m',
		green_bright: '\x1b[102m',
		yellow_bright: '\x1b[103m',
		blue_bright: '\x1b[104m'
	},
};


/* a game object that occupies one character on the screen */
class Entity {
	constructor(name, color_code, sym) {
		this.name = name;
		this.color_code = color_code;
		this.sym = sym || '\u0000';
	}
} 

/* will be used in future multiplayer */
class Player extends Entity {
	constructor(nickname){
		super('player', Vars.color_codes['red_bright'], '*')
		
		this.nickname = nickname;
	}
}


/* all existing game entities and their ids */
class Resourses {
	static load() {
		this.entities = {
	        [0]: new Entity('grass', Vars.color_codes_background['green']),
			[1]: new Entity('sand', Vars.color_codes_background['yellow_bright']),
			[2]: new Entity('water', Vars.color_codes_background['blue_bright']),
			[3]: new Entity('deep-water', Vars.color_codes_background['blue']),
			
			[4]: new Entity('bush', Vars.color_codes['green'], '@'),
			
			[5]: new Entity('player', Vars.color_codes['red_bright'], '*')
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
	constructor(generator){
		this.generator = generator;
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
				    playerpos.y -= 1;
					break;
				case 'down':
				    playerpos.y += 1;
					break;
				case 'left':
				    playerpos.x -= 1;
					break;
				case 'right':
				    playerpos.x += 1;
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
		
		keypress.disableMouse(process.stdout)
		
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
			let elevation = Math.abs(noise(x, y, 10, [1, 3, 4]));
			
			if(elevation <= 0.3){
				/* deep-water and water */
				return new Tile(elevation <= 0.1 ? 3 : 2, null)
			}else if(elevation <= 0.5){
				/* sandy beaches */
				return new Tile(1, null)
			}else{
				/* grass and bushes */
				return new Tile(0, (Math.random() > 0.9) ? 4 : null)
			}
		}).sizes(window_width, window_height);
	}
	
	static updateSizes() {
		window_width = process.stdout.getWindowSize()[0]+1;
        window_height = process.stdout.getWindowSize()[1];
		
		if(window_width != Vars.window_width || window_height != Vars.window_height){
			Game.crashed = true;
			process.stdout.write(`Current screen sizes:${window_width}x${window_height}  `)
			process.stdout.write(`${Vars.color_codes['red_bright']}Please set app properties > screen size: ${Vars.window_width-1}x${Vars.window_height} and restart the game!${Vars.color_codes['reset']}  `)
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
				    tileString += res.get(5).color_code;
                    tileString += res.get(5).sym;					
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
