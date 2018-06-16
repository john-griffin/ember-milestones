/* eslint-env node */

const compile = require('ember-cli-typescript/lib/utilities/compile');
const td = require('typedoc');
const { Context, Converter } = require('typedoc/dist/lib/converter');
const debug = require('debug')('playground');

const app = new td.Application();
const converter = app.converter;
const serializer = app.serializer;

let total = 0;

const program = compile({ root: __dirname, require }, { outDir: 'out', watch: true, noEmit: true }, {
  reportWatchStatus(diagnostic) {
    if (diagnostic.messageText.toString().indexOf('Compilation complete') !== -1) {
      setTimeout(() => {
        debug('will-run');
        const currentProgram = program.getCurrentProgram().getProgram();

        let context = new Context(converter, [], currentProgram.getTypeChecker(), currentProgram);

        converter.trigger(Converter.EVENT_BEGIN, context);

        debug('will-compile');
        for (let file of currentProgram.getSourceFiles()) {
          if (file.fileName.indexOf(__dirname) !== 0 || file.fileName.includes('node_modules')) continue;
          debug(file.fileName);
          converter.convertNode(context, file);
          console.log(context.project);
        }

        debug('will-resolve');
        converter.resolve(context);

        converter.trigger(Converter.EVENT_END, context);

        debug('will-serialize');
        let serialized = serializer.projectToObject(context.project);

        debug('will-write');
        require('fs').writeFileSync(`docs.${total++}.json`, JSON.stringify(serialized, null, 2));
        debug('done');
      });
    }
  },
});
