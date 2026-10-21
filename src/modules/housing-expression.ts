import type { Object3D } from 'three';

/** One original facial configuration at a time; body meshes are unaffected. */
export function setCharacterExpression(object: Object3D, expression = 1): void {
  object.traverse(node => {
    const match = /^expression_(\d+)_/.exec(node.name);
    if (match) node.visible = Number(match[1]) === expression;
  });
}
