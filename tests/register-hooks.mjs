// Register tsx loader so Node.js test runner can execute TypeScript files
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('tsx/esm', pathToFileURL('./'));
