
import { Card } from 'src/components/ui/card';

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className='overflow-x-auto rounded-md bg-muted p-4 text-sm leading-relaxed text-muted-foreground'>
      <code>{code}</code>
    </pre>
  );
}

const SolarIcon = () => {
  return (
    <>
      <Card className="flex flex-col gap-3 p-6">
        <div className="space-y-2">
          <h6> Installation</h6>
          <p>To use Iconify icons in your project, install the official React package:</p>
          <CodeBlock code={`npm i @iconify-icon/react`} />
        </div>
        <div className="space-y-2">
          <h6> Usage Example</h6>
          <p>Import and use any icon in your components:</p>
          <CodeBlock
            code={`import { Icon } from '@iconify-icon/react';
function MyComponent() {
  return <Icon icon='solar:arrow-right-linear' width='20' height='20' />;
}`}
          />
        </div>
        <div className="space-y-2">
          <h6>Explore Icons</h6>
          <iframe
            src="https://icon-sets.iconify.design/solar/"
            title="Inline Frame Example"
            width="100%"
            height="650"
          ></iframe>
        </div>
      </Card>
    </>
  );
};

export default SolarIcon;
