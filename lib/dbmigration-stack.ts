import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_python from '@aws-cdk/aws-lambda-python-alpha';

export class DbmigrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const handler = new lambda_python.PythonFunction(this, 'dbMigrationFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      entry: 'functions/db_migration',
      handler: 'index.lambda_handler',
    });
  }
}
