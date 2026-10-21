import { describe, expect, it } from 'vitest';
import { Group, Mesh } from 'three';
import { setCharacterExpression } from '../housing-expression';

describe('housing character expressions', () => {
  it('shows only one facial set without hiding the body', () => {
    const root = new Group();
    const body = new Mesh(); body.name = 'body_0';
    const first = new Mesh(); first.name = 'expression_1_face_0';
    const second = new Mesh(); second.name = 'expression_2_face_0';
    const mouth = new Mesh(); mouth.name = 'expression_2_mouth_1';
    root.add(body, first, second, mouth);
    setCharacterExpression(root, 2);
    expect(body.visible).toBe(true);
    expect(first.visible).toBe(false);
    expect(second.visible).toBe(true);
    expect(mouth.visible).toBe(true);
    setCharacterExpression(root);
    expect(first.visible).toBe(true);
    expect(second.visible).toBe(false);
    expect(mouth.visible).toBe(false);
  });

  it('keeps expression changes local to each model clone', () => {
    const source = new Group();
    const face = new Mesh(); face.name = 'expression_1_face'; source.add(face);
    const copy = source.clone(true);
    setCharacterExpression(copy, 2);
    expect(copy.children[0]!.visible).toBe(false);
    expect(source.children[0]!.visible).toBe(true);
  });
});
