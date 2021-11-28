import path from 'path';
import util from 'util';
import fs from 'fs-extra';
import isObject from 'is-plain-object';
import globby from 'globby';
import { green, bold, yellow } from 'colorette';

function stringify(value) {
  return util.inspect(value, {
    breakLength: Infinity
  });
}

async function isFile(filePath) {
  const fileStats = await fs.stat(filePath);
  return fileStats.isFile();
}

function renameTarget(target, rename, src) {
  const parsedPath = path.parse(target);
  return typeof rename === 'string' ? rename : rename(parsedPath.name, parsedPath.ext.replace('.', ''), src);
}

async function generateCopyTarget(src, dest, {
  flatten,
  rename,
  transform
}) {
  if (transform && !(await isFile(src))) {
    throw new Error(`"transform" option works only on files: '${src}' must be a file`);
  }

  const {
    base,
    dir
  } = path.parse(src);
  const destinationFolder = flatten || !flatten && !dir ? dest : dir.replace(dir.split('/')[0], dest);
  return {
    src,
    dest: path.join(destinationFolder, rename ? renameTarget(base, rename, src) : base),
    ...(transform && {
      contents: await transform(await fs.readFile(src), base)
    }),
    renamed: rename,
    transformed: transform
  };
}

function copy(options = {}) {
  const {
    copyOnce = false,
    flatten = true,
    hook = 'buildEnd',
    targets = [],
    verbose = false,
    ...restPluginOptions
  } = options;
  let copied = false;
  // 用于返回最终的构建路径
  return {
    name: 'copy',
    resolveId(options){
  
      console.log("this", this)
      this.meta.apiTargets = [...copyTargets]
    },
    buildEnd(name) {
      
      if (copyOnce && copied) {
        return;
      }
      if (this.meta.apiTargets.length) {
        if (verbose) {
          console.log(green('copied:'));
        }

        for (const copyTarget of this.meta.apiTargets) {
          const {
            contents,
            dest,
            src,
            transformed
          } = copyTarget;

          if (transformed) {
            await fs.outputFile(dest, contents, restPluginOptions);
          } else {
            await fs.copy(src, dest, restPluginOptions);
          }

          if (verbose) {
            let message = green(`  ${bold(src)} → ${bold(dest)}`);
            const flags = Object.entries(copyTarget).filter(([key, value]) => ['renamed', 'transformed'].includes(key) && value).map(([key]) => key.charAt(0).toUpperCase());

            if (flags.length) {
              message = `${message} ${yellow(`[${flags.join(', ')}]`)}`;
            }

            console.log(message);
          }
        }
      } else if (verbose) {
        console.log(yellow('no items to copy'));
      }

      copied = true;
    }
  };
}

export default copy;
