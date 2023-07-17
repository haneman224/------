"use strict";

let BodyStatic = 1;
let BodyDynamic = 2;
let ShapeCircle = 3;
let ShapeRectangle = 4;
let ShapeLine = 5;

function Vec(x, y) {
  this.x = x;
  this.y = y;
}

Vec.prototype.add = function (v) {
  return new Vec(this.x + v.x, this.y + v.y); // 加算
};

Vec.prototype.mul = function (x, y) {
  let r = y || x;
  return new Vec(this.x * x, this.y * r); // 掛算
};

Vec.prototype.dot = function (v) {
  return this.x * v.x + this.y * v.y; // 内積
};

Vec.prototype.cross = function (v) {
  return this.x * v.y - v.x * this.y; // 外積
};

Vec.prototype.move = function (dx, dy) {
  this.x += dx; // 自分を移動
  this.y += dy;
};

// 矩形オブジェクト
function RectangleEntity(x, y, width, height) {
  this.shape = ShapeRectangle;
  this.type = BodyStatic;
  this.x = x;
  this.y = y;
  this.w = width;
  this.h = height;
  this.deceleration = 1.0;
  this.isHit = function (i, j) {
    return (
      this.x <= i && i <= this.x + this.w && this.y <= j && j <= this.y + this.h
    );
  };
}

// 線オブジェクト
function LineEntity(x0, y0, x1, y1, restitution) {
  this.shape = ShapeLine;
  this.type = BodyStatic;
  this.x = (x0 + x1) / 2;
  this.y = (y0 + y1) / 2;
  this.x0 = x0;
  this.y0 = y0;
  this.x1 = x1;
  this.y1 = y1;

  this.restitution = restitution || 0.9;
  this.vec = new Vec(x1 - x0, y1 - y0);
  let length = Math.sqrt(Math.pow(this.vec.x, 2) + Math.pow(this.vec.y, 2));
  this.norm = new Vec(y0 - y1, x1 - x0).mul(1 / length);
}

// 円オブジェクト
function CircleEntity(x, y, radius, type, restitution, deceleration) {
  this.shape = ShapeCircle;
  this.type = type || BodyDynamic;
  this.x = x;
  this.y = y;
  this.radius = radius;
  this.restitution = restitution || 0.9;
  this.deceleration = deceleration || 1.0;
  this.accel = new Vec(0, 0);
  this.velocity = new Vec(0, 0);

  this.move = function (dx, dy) {
    // 円を移動
    this.x += dx;
    this.y += dy;
  };

  this.isHit = function (x, y) {
    let d2 = Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2);
    return d2 < Math.pow(this.radius, 2);
  };

  this.collidedWithRect = function (r) {
    // 円と矩形の衝突
    // 矩形の４辺上で最も円に近い座標(nx, ny)を求める
    let nx = Math.max(r.x, Math.min(this.x, r.x + r.w));
    let ny = Math.max(r.y, Math.min(this.y, r.y + r.h));

    if (!this.isHit(nx, ny)) {
      // 衝突なし→リターン
      return;
    }

    if (this.onhit) {
      // 衝突時のコールバック
      this.onhit(this, r);
    }

    let d2 = Math.pow(nx - this.x, 2) + Math.pow(ny - this.y, 2);
    let overlap = Math.abs(this.radius - Math.sqrt(d2));
    let mx = 0,
      my = 0;

    if (ny == r.y) {
      // 上辺衝突
      my = -overlap;
    } else if (ny == r.y + r.h) {
      // 下辺衝突
      my = overlap;
    } else if (nx == r.x) {
      // 左辺衝突
      mx = -overlap;
    } else if (nx == r.x + r.w) {
      // 右辺衝突
      mx = overlap;
    } else {
      // 矩形の中
      mx = -this.velocity.x;
      my = -this.velocity.y;
    }

    this.move(mx, my);
    if (mx) {
      // X軸方向へ反転
      this.velocity = this.velocity.mul(-1 * this.restitution, 1);
    }
    if (my) {
      // Y軸方向へ反転
      this.velocity = this.velocity.mul(1, -1 * this.restitution);
    }
  };

  this.collidedWithLine = function (line) {
    // 円と線の衝突
    let v0 = new Vec(
      line.x0 - this.x + this.velocity.x,
      line.y0 - this.y + this.velocity.y
    );
    let v1 = this.velocity;
    let v2 = new Vec(line.x1 - line.x0, line.y1 - line.y0);
    let cv1v2 = v1.cross(v2);
    let t1 = v0.cross(v1) / cv1v2;
    let t2 = v0.cross(v2) / cv1v2;
    let crossed = 0 <= t1 && t1 <= 1 && 0 <= t2 && t2 <= 1;

    if (crossed) {
      this.move(-this.velocity.x, -this.velocity.y);
      let dot0 = this.velocity.dot(line.norm); // 法線と速度の内積
      let vec0 = line.norm.mul(-2 * dot0);
      this.velocity = vec0.add(this.velocity);
      this.velocity = this.velocity.mul(line.restitution * this.restitution);
    }
  };

  this.collidedWithCircle = function (peer) {
    // 円と円の衝突
    let d2 = Math.pow(peer.x - this.x, 2) + Math.pow(peer.y - this.y, 2);
    if (d2 >= Math.pow(this.radius + peer.radius, 2)) {
      return;
    }

    if (this.onhit) {
      this.onhit(this, peer);
    }
    if (peer.onhit) {
      peer.onhit(peer, this);
    }

    let distance = Math.sqrt(d2) || 0.01;
    let overlap = this.radius + peer.radius - distance;

    let v = new Vec(this.x - peer.x, this.y - peer.y);
    let aNormUnit = v.mul(1 / distance); // 法線単位ベクトル１
    let bNormUnit = aNormUnit.mul(-1); // 法線単位ベクトル２

    if (this.type == BodyDynamic && peer.type == BodyStatic) {
      this.move(aNormUnit.x * overlap, aNormUnit.y * overlap);
      let dot0 = this.velocity.dot(aNormUnit); // 法線と速度の内積
      let vec0 = aNormUnit.mul(-2 * dot0);
      this.velocity = vec0.add(this.velocity);
      this.velocity = this.velocity.mul(this.restitution);
    } else if (peer.type == BodyDynamic && this.type == BodyStatic) {
      peer.move(bNormUnit.x * overlap, bNormUnit.y * overlap);
      let dot1 = peer.velocity.dot(bNormUnit); // 法線と速度の内積
      let vec1 = bNormUnit.mul(-2 * dot1);
      peer.velocity = vec1.add(peer.velocity);
      peer.velocity = peer.velocity.mul(peer.restitution);
    } else {
      this.move((aNormUnit.x * overlap) / 2, (aNormUnit.y * overlap) / 2);
      peer.move((bNormUnit.x * overlap) / 2, (bNormUnit.y * overlap) / 2);

      let aTangUnit = new Vec(aNormUnit.y * -1, aNormUnit.x); // 接線ベクトル１
      let bTangUnit = new Vec(bNormUnit.y * -1, bNormUnit.x); // 接線ベクトル２

      let aNorm = aNormUnit.mul(aNormUnit.dot(this.velocity)); // aベクトル法線成分
      let aTang = aTangUnit.mul(aTangUnit.dot(this.velocity)); // aベクトル接線成分
      let bNorm = bNormUnit.mul(bNormUnit.dot(peer.velocity)); // bベクトル法線成分
      let bTang = bTangUnit.mul(bTangUnit.dot(peer.velocity)); // bベクトル接線成分

      this.velocity = new Vec(bNorm.x + aTang.x, bNorm.y + aTang.y);
      peer.velocity = new Vec(aNorm.x + bTang.x, aNorm.y + bTang.y);
    }
  };
}

// 物理エンジン
function Engine(x, y, width, height, gravityX, gravityY) {
  this.worldX = x || 0;
  this.worldY = y || 0;
  this.worldW = width || 1000;
  this.worldH = height || 1000;
  this.gravity = new Vec(gravityX, gravityY);
  this.entities = [];

  this.setGravity = function (x, y) {
    this.gravity.x = x;
    this.gravity.y = y;
  };

  this.step = function (elapsed) {
    let gravity = this.gravity.mul(elapsed, elapsed);
    let entities = this.entities;

    // entityを移動
    entities.forEach(function (e) {
      if (e.type == BodyDynamic) {
        let accel = e.accel.mul(elapsed, elapsed);
        e.velocity = e.velocity.add(gravity);
        e.velocity = e.velocity.add(accel);
        e.velocity = e.velocity.mul(e.deceleration);
        e.move(e.velocity.x, e.velocity.y);
      }
    });

    // 範囲外のオブジェクトを削除
    this.entities = entities.filter(function (e) {
      return (
        this.worldX <= e.x &&
        e.x <= this.worldX + this.worldW &&
        this.worldY <= e.y &&
        e.y <= this.worldY + this.worldH
      );
    }, this);

    // 衝突判定 & 衝突処理
    for (let i = 0; i < entities.length - 1; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        let e0 = entities[i],
          e1 = entities[j];
        if (e0.type == BodyStatic && e1.type == BodyStatic) {
          continue;
        }

        if (e0.shape == ShapeCircle && e1.shape == ShapeCircle) {
          e0.collidedWithCircle(e1);
        } else if (e0.shape == ShapeCircle && e1.shape == ShapeLine) {
          e0.collidedWithLine(e1);
        } else if (e0.shape == ShapeLine && e1.shape == ShapeCircle) {
          e1.collidedWithLine(e0);
        } else if (e0.shape == ShapeCircle && e1.shape == ShapeRectangle) {
          e0.collidedWithRect(e1);
        } else if (e0.shape == ShapeRectangle && e1.shape == ShapeCircle) {
          e1.collidedWithRect(e0);
        }
      }
    }
  };
}
