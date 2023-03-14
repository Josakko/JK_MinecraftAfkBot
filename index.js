const mineflayer = require('mineflayer');
const Movements = require('mineflayer-pathfinder').Movements;
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { GoalBlock, GoalXZ } = require('mineflayer-pathfinder').goals;
const log4js = require("log4js");
const config = require('./config.json');


log4js.configure({
    appenders: {
        console: { type: "console" },
    },
    categories: {
        default: {
            appenders: ["console"],
            level: "info"
        }
    },
    layouts: {
        customLayout: {
            type: 'pattern',
            pattern: '%c - %m %d %-5p{hh:mm:ss}',
        }
    }
});

const logger = log4js.getLogger();

function createBot() {
   const bot = mineflayer.createBot({
      username: config['bot-account']['username'],
      host: config.server.ip,
      port: config.server.port,
      version: config.server.version,
   });

   bot.loadPlugin(pathfinder);
   const mcData = require('minecraft-data')(bot.version);
   const defaultMove = new Movements(bot, mcData);
   bot.settings.colorsEnabled = false;
   bot.pathfinder.setMovements(defaultMove);

   bot.once('spawn', () => {
      logger.info("Bot joined the server!");

      if (config.utils['auto-auth'].enabled) {
         logger.info("Auto-Auth enabled!");

         let password = config.utils['auto-auth'].password;
         setTimeout(() => {
            bot.chat(`/register ${password} ${password}`);
            bot.chat(`/login ${password}`);
         }, 500);

         logger.info(`Bot executed auth command, password used "${password}"!`);
      }

      if (config.utils['chat-messages'].enabled) {
         logger.info('Chat messages enabled!');

         let messages = config.utils['chat-messages']['messages'];

         if (config.utils['chat-messages'].repeat) {
            let delay = config.utils['chat-messages']['repeat-delay'];
            let i = 0;

            setInterval(() => {
               bot.chat(`${messages[i]}`);

               if (i + 1 === messages.length) {
                  i = 0;
               } else i++;
            }, delay * 1000);
         } else {
            messages.forEach((msg) => {
               bot.chat(msg);
            });
         }
      }

      if (config.utils['commands'].enabled) {
         logger.info(`Commands enabled!`);   

         let command = config.utils['commands']['command'];

         if (config.utils['commands'].repeat) {
            let delay = config.utils['commands']['repeat-delay'];
            let i = 0;

            setInterval(() => {
               bot.chat(`/${command[i]}`);

               if (i + 1 === command.length) {
                  i = 0;
               } else i++;
            }, delay * 1000);
         } else {
            command.forEach((cmd) => {
               bot.chat(cmd);
            });
         }
      }

      const pos = config.position;

      if (config.position.enabled) {
         logger.info(
             `Bot started moving to target location: ${pos.x}, ${pos.y}, ${pos.z}`
         );
         bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
      }

      if (config.utils['anti-afk'].enabled) {
         if (config.utils['anti-afk'].sneak) {
            bot.setControlState('sneak', true);
         }

         if (config.utils['anti-afk'].jump) {
            bot.setControlState('jump', true);
         }

         if (config.utils['anti-afk']['hit'].enabled) {
            let delay = config.utils['anti-afk']['hit']['delay'];
            let attackMobs = config.utils['anti-afk']['hit']['attack-mobs']

            setInterval(() => {
               if(attackMobs) {
                     let entity = bot.nearestEntity(e => e.type !== 'object' && e.type !== 'player'
                         && e.type !== 'global' && e.type !== 'orb' && e.type !== 'other');

                     if(entity) {
                        bot.attack(entity);
                        return
                     }
               }

               bot.swingArm("right", true);
            }, delay);
         }

         if (config.utils['anti-afk'].rotate) {
            setInterval(() => {
               bot.look(bot.entity.yaw + 1, bot.entity.pitch, true);
            }, 100);
         }

         if (config.utils['anti-afk']['loop-walk'].enabled) {
            let radius = config.utils['anti-afk']['loop-walk']['radius']
            loopWalk(bot, radius);
         }
      }
   });

   bot.on('chat', (username, message) => {
      if (config.utils['chat-log']) {
         logger.info(`[${username}] ${message}`);
      }
   });

   bot.on('goal_reached', () => {
      if(config.position.enabled) {
         logger.info(
             `Bot arrived to target location: ${bot.entity.position}`
         );
      }
   });

   bot.on('death', () => {
      logger.warn(
         `Bot died, respawning at: ${bot.entity.position}`
      );
   });

   if (config.utils['auto-reconnect']) {
      bot.on('end', () => {
         setTimeout(() => {
            createBot();
         }, config.utils['auto-reconnect-delay']);
      });
   }

   bot.on('kicked', (reason) => {
      let reasonText = JSON.parse(reason).text;
      if(reasonText === '') {
         reasonText = JSON.parse(reason).extra[0].text
      }
      reasonText = reasonText.replace();

      logger.warn(`Bot was kicked from the server. Reason: "${reasonText}"`)
   }
   );

   bot.on('error', (error) =>
      logger.error(`An error occurred, please try again. Error message: ${error.message}`)
   );
}

function loopWalk(bot, radius) {
    return new Promise(() => {
        const pos = bot.entity.position;
        const x = pos.x;
        const y = pos.y;
        const z = pos.z;

        const points = [
            [x + radius, y, z],
            [x, y, z + radius],
            [x - radius, y, z],
            [x, y, z - radius],
        ];

        let i = 0;
        setInterval(() => {
             if(i === points.length) i = 0;
             bot.pathfinder.setGoal(new GoalXZ(points[i][0], points[i][2]));
             i++;
        }, 1000);
    });
}

createBot();


//nexe -i index.js -o index.exe --exclude config.json --build --resource icon.ico --icon icon.ico
//pkg .
