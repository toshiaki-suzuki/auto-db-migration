import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambda_python from '@aws-cdk/aws-lambda-python-alpha';
import * as path from 'path';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';

export class DbmigrationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'DbMigrationVpc', {
      vpcName: 'db-migration-vpc',
      cidr: '10.0.0.0/16',
      maxAzs: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'PrivateSubnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      natGateways: 0,
    });

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

    const provider = new Provider(this, "Provider", {
      onEventHandler: handler,
    });

    new cdk.CustomResource(this, "Custom::Migration", {
      serviceToken: provider.serviceToken,
      properties: {DummyValue: Date.now().toString(),}, // ダミーのプロパティを設定してリソースの更新をトリガー
    });
  }
}
