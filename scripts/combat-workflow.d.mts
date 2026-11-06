export function rolePotentialIds(pool:Record<string,unknown>,role:'main'|'support'):number[];
export interface MatrixCase {name:string;limitBreak:number;potentials:Record<number,number>}
export function matrixCases(ids:number[],definitions:Record<number,{MaxLevel?:number}>):MatrixCase[];
