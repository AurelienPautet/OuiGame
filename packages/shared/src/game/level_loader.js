import { Block } from "./Block.js";
import { Hole } from "./Hole.js";
import { CollisionBox } from "./CollisionBox.js";

export function generateBcollision(room) {
  //generate the collision boxes for the blocks in the level and merge them if they are touching each other to reduce the number of collision boxes to check
  let boxed = [];
  let i = 0;
  room.Bcollision = [];
  //generate the collision boxes for the blocks
  while (i < room.blocklist.length) {
    let l = 1;
    let col = 1;
    if (
      (room.blocklist[i] == 1 || room.blocklist[i] == 2) &&
      boxed.includes(i) == false
    ) {
      while (
        (room.blocklist[i + l] == 1 || room.blocklist[i + l] == 2) &&
        (i % 23) + l < 23 &&
        boxed.includes(i + l) == false
      ) {
        l++;
      }
      while (
        (room.blocklist[i + 23 * col] == 1 ||
          room.blocklist[i + 23 * col] == 2) &&
        Math.floor(i / 23) + col < 16 &&
        boxed.includes(i + 23 * col) == false
      ) {
        col++;
      }
      if (col > l) {
        l = 1;
        for (let b = 0; b < col; b++) {
          boxed.push(i + b * 23);
        }
      } else {
        col = 1;
        for (let b = 0; b < l; b++) {
          boxed.push(i + b);
        }
      }
      room.Bcollision.push(
        new CollisionBox(
          { x: (i % 23) * 50, y: Math.floor(i / 23) * 50 },
          { w: l * 50, h: col * 50 }
        )
      );
    }
    i++;
  }
  boxed = [];
  //merge the collision boxes that are touching each other on the y axis
  for (let i = 0; i < room.Bcollision.length; i++) {
    for (let e = 0; e < room.Bcollision.length; e++) {
      if (
        i != e &&
        room.Bcollision[i].position.x === room.Bcollision[e].position.x &&
        room.Bcollision[i].position.y + room.Bcollision[i].size.h ===
          room.Bcollision[e].position.y &&
        room.Bcollision[i].size.w === room.Bcollision[e].size.w
      ) {
        room.Bcollision.push(
          new CollisionBox(
            {
              x: room.Bcollision[i].position.x,
              y: room.Bcollision[i].position.y,
            },
            {
              w: room.Bcollision[i].size.w,
              h: room.Bcollision[i].size.h + room.Bcollision[e].size.h,
            }
          )
        );
        if (i > e) {
          room.Bcollision.splice(i, 1);
          room.Bcollision.splice(e, 1);
        } else {
          room.Bcollision.splice(e, 1);
          room.Bcollision.splice(i, 1);
        }
        i = 0;
        e = 0;
      }
    }
  }
  //merge the collision boxes that are touching each other on the x axis
  for (let i = 0; i < room.Bcollision.length; i++) {
    for (let e = 0; e < room.Bcollision.length; e++) {
      if (
        i != e &&
        room.Bcollision[i].position.y === room.Bcollision[e].position.y &&
        room.Bcollision[i].position.x + room.Bcollision[i].size.w ===
          room.Bcollision[e].position.x &&
        room.Bcollision[i].size.h === room.Bcollision[e].size.h
      ) {
        room.Bcollision.push(
          new CollisionBox(
            {
              x: room.Bcollision[i].position.x,
              y: room.Bcollision[i].position.y,
            },
            {
              w: room.Bcollision[i].size.w + room.Bcollision[e].size.w,
              h: room.Bcollision[i].size.h,
            }
          )
        );
        if (i > e) {
          room.Bcollision.splice(i, 1);
          room.Bcollision.splice(e, 1);
        } else {
          room.Bcollision.splice(e, 1);
          room.Bcollision.splice(i, 1);
        }
        i = 0;
        e = 0;
      }
    }
  }
  //remove the collision boxes that are the same if they are any
  for (let i = 0; i < room.Bcollision.length; i++) {
    for (let e = 0; e < room.Bcollision.length; e++) {
      if (
        i != e &&
        room.Bcollision[i].position.x === room.Bcollision[e].position.x &&
        room.Bcollision[i].position.y === room.Bcollision[e].position.y &&
        room.Bcollision[i].size.w === room.Bcollision[e].size.w &&
        room.Bcollision[i].size.h === room.Bcollision[e].size.h
      ) {
        if (i > e) {
          room.Bcollision.splice(i, 1);
          room.Bcollision.splice(e, 1);
        } else {
          room.Bcollision.splice(e, 1);
          room.Bcollision.splice(i, 1);
        }
        i = 0;
        e = 0;
      }
    }
  }
}

export async function loadlevel(level_json, room) {
  room.blocklist = level_json;
  room.blocks = [];
  room.spawns = [];
  room.holes = [];
  room.bot1_spawns = [];
  room.bot2_spawns = [];
  room.bot3_spawns = [];
  room.bot4_spawns = [];

  for (let l = 0; l <= 16; l++) {
    for (let c = 0; c <= 23; c++) {
      if (room.blocklist[l * 23 + c] == 1) {
        room.blocks.push(new Block({ x: c * 50, y: l * 50 }, 1));
      } else if (room.blocklist[l * 23 + c] == 2) {
        room.blocks.push(new Block({ x: c * 50, y: l * 50 }, 2));
      } else if (room.blocklist[l * 23 + c] == 3) {
        room.spawns.push({ x: c * 50, y: l * 50 });
      } else if (room.blocklist[l * 23 + c] == 4) {
        room.holes.push(new Hole({ x: c * 50, y: l * 50 }));
      } else if (room.blocklist[l * 23 + c] == 11) {
        room.bot1_spawns.push({ x: c * 50, y: l * 50 });
      } else if (room.blocklist[l * 23 + c] == 12) {
        room.bot2_spawns.push({ x: c * 50, y: l * 50 });
      } else if (room.blocklist[l * 23 + c] == 13) {
        room.bot3_spawns.push({ x: c * 50, y: l * 50 });
      } else if (room.blocklist[l * 23 + c] == 14) {
        room.bot4_spawns.push({ x: c * 50, y: l * 50 });
      }
    }
  }
  generateBcollision(room);
}
