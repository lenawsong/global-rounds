import { useMemo, useState } from 'react';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Select,
  Space,
  Steps,
  Typography,
  Upload
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ChartCard } from '../components/ChartCard';
import ordersSample from '../sample/orders.json';
import type { PortalOrderListResponse } from '@gr/api';

const { Dragger } = Upload;

type IntakeFormValues = {
  patient_id: string;
  patient_name: string;
  dob?: dayjs.Dayjs;
  contact_email?: string;
  contact_phone?: string;
  payer?: string;
  sku: string;
  quantity: number;
  priority: 'urgent' | 'high' | 'normal';
  justification?: string;
  desired_start?: dayjs.Dayjs;
};

const defaultInitialValues: IntakeFormValues = {
  patient_id: 'P04512',
  patient_name: 'Jules Hart',
  dob: dayjs().subtract(36, 'year'),
  contact_email: 'jules.hart@nexus.health',
  contact_phone: '202-555-0199',
  payer: 'DC Health Alliance',
  sku: 'OXY-CONS-5L',
  quantity: 24,
  priority: 'urgent',
  justification: 'Post-acute oxygen therapy with nightly monitoring.',
  desired_start: dayjs().add(2, 'day')
};

const ordersData = (ordersSample as PortalOrderListResponse).orders ?? [];
const skuOptions = Array.from(
  new Set(ordersData.map((order) => order.supply_sku).filter(Boolean))
).map((sku) => ({ label: sku, value: sku }));

const stepFieldGroups: Array<(keyof IntakeFormValues)[]> = [
  ['patient_id', 'patient_name', 'dob', 'contact_email', 'contact_phone', 'payer'],
  ['sku', 'quantity', 'priority', 'justification', 'desired_start']
];

export function IntakePage() {
  const [form] = Form.useForm<IntakeFormValues>();
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const stepItems = useMemo(
    () => [
      { title: 'Patient', description: 'Core demographics & contact paths' },
      { title: 'Order', description: 'Therapy configuration & urgency' },
      { title: 'Documents', description: 'Upload scripts, chart notes, CMNs' },
      { title: 'Review', description: 'Verify details before automation' }
    ],
    []
  );

  const preview = useMemo(() => {
    const values = form.getFieldsValue();
    return {
      ...values,
      dob: values.dob ? values.dob.format('YYYY-MM-DD') : undefined,
      desired_start: values.desired_start ? values.desired_start.format('YYYY-MM-DD') : undefined,
      documents: fileList.map((file) => ({
        name: file.name,
        size_kb: file.size ? Math.round(file.size / 1024) : undefined,
        type: file.type
      }))
    };
  }, [form, fileList, currentStep]);

  const isLastStep = currentStep === stepItems.length - 1;
  const isDocumentsStep = currentStep === 2;

  const handleNext = async () => {
    try {
      if (currentStep < stepFieldGroups.length) {
        const fields = stepFieldGroups[currentStep];
        await form.validateFields(fields);
      }
      if (isDocumentsStep && fileList.length === 0) {
        message.warning('Attach at least one intake document before continuing.');
        return;
      }
      if (isLastStep) {
        await submitIntake();
        return;
      }
      setCurrentStep((prev) => prev + 1);
    } catch {
      /* validation errors already surfaced */
    }
  };

  const submitIntake = async () => {
    try {
      await form.validateFields(stepFieldGroups.flat());
      if (fileList.length === 0) {
        message.warning('Attach at least one intake document before submitting.');
        setCurrentStep(2);
        return;
      }
      setSubmitting(true);
      await new Promise((resolve) => setTimeout(resolve, 900));
      message.success('Intake packet queued. Automation agents will ingest the draft.');
      setCurrentStep(0);
      setFileList([]);
      form.resetFields();
      form.setFieldsValue(defaultInitialValues);
    } catch (error: any) {
      if (error?.errorFields) {
        message.error('Double-check the highlighted intake fields.');
      } else {
        message.error('Submission failed. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <ChartCard
        title="Client intake"
        subTitle="Upload intake packets, pre-fill patient metadata, and hand-off to Nexus automation."
      >
        <Steps current={currentStep} responsive items={stepItems} />
      </ChartCard>

      <ChartCard
        title={stepItems[currentStep].title}
        subTitle={stepItems[currentStep].description}
        extra={
          currentStep === 0 ? (
            <Button onClick={() => form.setFieldsValue(defaultInitialValues)}>Autofill sample</Button>
          ) : undefined
        }
      >
        <Form
          layout="vertical"
          form={form}
          initialValues={defaultInitialValues}
          style={{ width: '100%' }}
        >
          {currentStep === 0 && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Patient name"
                  name="patient_name"
                  rules={[{ required: true, message: 'Patient name is required' }]}
                >
                  <Input placeholder="Patricia Allen" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Patient ID"
                  name="patient_id"
                  rules={[{ required: true, message: 'Provide a patient identifier' }]}
                >
                  <Input placeholder="P04512" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Date of birth"
                  name="dob"
                  rules={[{ required: true, message: 'Date of birth is required' }]}
                >
                  <DatePicker className="w-full" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Contact email" name="contact_email">
                  <Input type="email" placeholder="patient@provider.com" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Contact phone" name="contact_phone">
                  <Input placeholder="(555) 123-4567" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Payer" name="payer">
                  <Input placeholder="DC Health Alliance" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {currentStep === 1 && (
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Supply SKU"
                  name="sku"
                  rules={[{ required: true, message: 'Select a SKU' }]}
                >
                  <Select
                    showSearch
                    options={skuOptions}
                    placeholder="OXY-CONS-5L"
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Quantity"
                  name="quantity"
                  rules={[{ required: true, message: 'Enter a quantity' }]}
                >
                  <InputNumber min={1} max={500} className="w-full" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Priority"
                  name="priority"
                  rules={[{ required: true, message: 'Select a priority' }]}
                >
                  <Select
                    options={[
                      { value: 'urgent', label: 'Urgent (0-2 days)' },
                      { value: 'high', label: 'High (3-5 days)' },
                      { value: 'normal', label: 'Normal (5+ days)' }
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Desired start date" name="desired_start">
                  <DatePicker className="w-full" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="Clinical justification" name="justification">
                  <Input.TextArea rows={4} placeholder="Explain therapy need, prior utilization, and payer guardrails." />
                </Form.Item>
              </Col>
            </Row>
          )}

          {currentStep === 2 && (
            <Dragger
              multiple
              beforeUpload={() => false}
              fileList={fileList}
              onChange={(info) => setFileList(info.fileList)}
              style={{ padding: '24px 0' }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <Typography.Title level={5}>Drop intake documents</Typography.Title>
              <Typography.Paragraph type="secondary">
                Clinical notes, CMNs, prior auth requests, ID scans. PDFs, images, and text files supported.
              </Typography.Paragraph>
            </Dragger>
          )}

          {currentStep === 3 && (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Typography.Text strong>Intake summary</Typography.Text>
              <Card
                size="small"
                style={{ borderRadius: 12, background: '#f8fafc' }}
                bodyStyle={{ fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: 12 }}
              >
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </Card>
            </Space>
          )}
        </Form>

        <Space style={{ marginTop: 24 }} size={12}>
          <Button onClick={handlePrev} disabled={currentStep === 0}>
            Back
          </Button>
          <Button type="primary" onClick={handleNext} loading={submitting}>
            {isLastStep ? 'Submit intake' : 'Next'}
          </Button>
        </Space>
      </ChartCard>

      <Card
        title="How it works"
        style={{ borderRadius: 16, boxShadow: '0 18px 48px -28px rgba(15,23,42,0.35)' }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Paragraph>
            Intake packets land in the automation rail, triggering payer, compliance, and inventory agents. The queue above
            mirrors the sample workflow in <code>automation_prototype/data/intake</code>. Uploads stay local in this demo.
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Need a template? Start with <code>docs/patient_intake_template.pdf</code> or drag any PDF to test the parser.
          </Typography.Paragraph>
        </Space>
      </Card>
    </Space>
  );
}
