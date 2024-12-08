import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_python from '@aws-cdk/aws-lambda-python-alpha';
import * as path from 'path';

export class DbmigrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const layer = new lambda_python.PythonLayerVersion(this, "dbMigrationLayer", {
      layerVersionName: "db-migration-layer",
      entry: path.join(__dirname, 'lambda-layer'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
    });

    const handler = new lambda_python.PythonFunction(this, 'dbMigrationFunction', {
      functionName: 'db-migration-function',
      runtime: lambda.Runtime.PYTHON_3_11,
      entry: path.join(__dirname, 'lambda-functions', 'db_migration'),
      handler: 'lambda_handler',
      layers: [layer],
    });
  }
}
