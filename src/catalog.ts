import malts from '../data/malts.json';
import hops from '../data/hops.json';
import yeasts from '../data/yeasts.json';
import descriptors from '../data/descriptors.json';
import vocabulary from '../data/vocabulary.json';
import styles from '../data/styles.json';
import type {Catalog} from './engine/types';
export const catalog = {malts,hops,yeasts,descriptors,vocabulary,styles} as Catalog;
